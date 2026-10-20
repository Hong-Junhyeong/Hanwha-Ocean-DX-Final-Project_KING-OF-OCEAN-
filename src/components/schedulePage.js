import { icon } from './icons.js';
import { facilities } from '../data/projectData.js';

const timelineSegments = {
  T10: [{ day: 0, start: 0, end: 4 }],
  T20: [
    { day: 0, start: 4, end: 5 },
    { day: 0, start: 6, end: 9 },
    { day: 1, start: 0, end: 5 },
    { day: 1, start: 6, end: 9 },
    { day: 2, start: 0, end: 4 },
  ],
  T30: [{ day: 2, start: 4, end: 5 }, { day: 2, start: 6, end: 8 }],
  T40: [{ day: 2, start: 8, end: 9 }],
};

const taskTone = { T10: 'fitup', T20: 'weld', T30: 'finish', T40: 'gate' };
const dayLabels = ['10.12 (월)', '10.13 (화)', '10.14 (수)'];

function formatDateTime(value) {
  if (!value) return '-';
  const [date, time] = value.slice(0, 16).split('T');
  return `${date.replaceAll('-', '.')} ${time}`;
}

function perWorkerHours(task, crew) {
  return crew > 0 ? task.remaining_mh / crew : 0;
}

function selectionLabel(state) {
  if (state.selectedBlock) return state.selectedBlock;
  return facilities[state.selectedFacility]?.name || '선택 없음';
}

function renderSelectionState(state) {
  const hasSelection = Boolean(state.selectedFacility);
  const title = hasSelection ? `${selectionLabel(state)} 일정 데이터 미연결` : '생산 일정 조회 대상이 선택되지 않았습니다.';
  const message = hasSelection
    ? '선택한 시설 또는 블록에는 제공된 v2 기준 일정이 없습니다. B-203 일정을 복사해 표시하지 않습니다.'
    : 'Overview의 조선소 야드에서 B-203을 선택한 뒤 생산 계획 및 일정 메뉴를 열어 주세요.';

  return `
    <section class="schedule-empty" aria-labelledby="schedule-empty-title">
      <div class="schedule-empty__icon">${icon(hasSelection ? 'calendar' : 'cursor')}</div>
      <span class="eyebrow">SELECTION REQUIRED</span>
      <h2 id="schedule-empty-title">${title}</h2>
      <p>${message}</p>
      <button type="button" class="overview-action" data-go-overview>${icon('home')} Overview로 이동</button>
      <div class="schedule-empty__boundary">${icon('info')} 현재 상세 생산 일정은 B-203에만 연결되어 있습니다.</div>
    </section>
  `;
}

function summaryCards(project) {
  const overview = project.overview;
  const cards = [
    ['선택 블록', overview.blockId],
    ['기준 시작', formatDateTime(overview.snapshot)],
    ['참조 마감', formatDateTime(overview.blockHandoverDeadline)],
    ['잔여 정상 작업', `${overview.normalRemainingMH} MH`],
    ['가용 인원', `${overview.crew}명`],
    ['정규 가용 능력', `${overview.regularCapacityMH} MH`],
    ['정규 일정 여유', `${overview.regularBufferHours}시간`],
  ];
  return cards.map(([label, value], index) => `
    <article class="schedule-stat ${index === cards.length - 1 ? 'schedule-stat--critical' : ''}">
      <span>${label}</span><strong>${value}</strong>
    </article>`).join('');
}

function ganttHeader() {
  return `
    <div class="gantt-line gantt-line--header">
      <div class="gantt-task-head">생산 작업</div>
      <div class="gantt-timeline-head">
        ${dayLabels.map((label) => `
          <div class="gantt-day-head">
            <strong>${label}</strong>
            <div class="gantt-clock"><span>07:00</span><span>12:00</span><span>13:00</span><span>16:00</span></div>
            <small>07–12 작업 · 12–13 점심 · 13–16 작업</small>
          </div>`).join('')}
      </div>
      <div class="gantt-values-head">시작–종료 / 잔여</div>
    </div>`;
}

function taskSegments(task) {
  const segments = timelineSegments[task.id] || [];
  const byDay = dayLabels.map((_, day) => segments.filter((segment) => segment.day === day));
  return `
    <div class="gantt-timeline" aria-label="${task.id} ${task.label} 작업 시간대">
      ${byDay.map((daySegments, day) => `
        <div class="gantt-day-track" aria-label="${dayLabels[day]}">
          <span class="gantt-lunch" aria-hidden="true"></span>
          ${daySegments.map((segment, index) => `
            <button
              type="button"
              class="gantt-bar-segment gantt-bar-segment--${taskTone[task.id]}"
              style="grid-column:${segment.start + 1}/${segment.end + 1}"
              data-gantt-task="${task.id}"
              aria-label="${task.id} ${task.label}, ${formatDateTime(task.start)}부터 ${formatDateTime(task.end)}까지, ${task.remaining_mh} MH, ${task.duration_work_h} 작업시간"
              title="${task.id} ${task.label} · ${task.remaining_mh} MH · ${task.duration_work_h}h${daySegments.length > 1 ? ` · 구간 ${index + 1}` : ''}"
            ><span>${task.id}</span></button>`).join('')}
        </div>`).join('')}
      <span class="gantt-global-marker gantt-global-marker--gate" aria-hidden="true"><em>검사 게이트</em></span>
      <span class="gantt-global-marker gantt-global-marker--deadline" aria-hidden="true"><em>참조 마감</em></span>
    </div>`;
}

function ganttRows(tasks) {
  return tasks.map((task) => `
    <div class="gantt-line gantt-line--task">
      <div class="gantt-task-name"><span>${task.id}</span><strong>${task.label}</strong><small>${task.duration_work_h} 작업시간</small></div>
      ${taskSegments(task)}
      <div class="gantt-task-values"><strong>${task.remaining_mh} MH</strong><span>${formatDateTime(task.start)}</span><span>${formatDateTime(task.end)}</span></div>
    </div>`).join('');
}

function renderGantt(project) {
  const tasks = project.workSequence.steps;
  return `
    <section class="panel schedule-gantt" aria-labelledby="gantt-title">
      <div class="schedule-section-head">
        <div><span class="eyebrow">WORKING-TIME GANTT</span><h2 id="gantt-title">B-203 기준 생산 Gantt</h2></div>
        <div class="calendar-key"><span class="key-work"></span>정규 작업시간 <span class="key-break"></span>점심·비가동 <span class="key-gate"></span>검사 게이트</div>
      </div>
      <div class="gantt-scroll" tabindex="0" aria-label="B-203 일정표. 작은 화면에서는 가로로 스크롤할 수 있습니다.">
        <div class="gantt-chart" role="group" aria-label="2026년 10월 12일부터 14일까지 작업시간 기준 Gantt 차트">
          ${ganttHeader()}
          ${ganttRows(tasks)}
        </div>
      </div>
      <div class="gantt-detail" data-gantt-detail aria-live="polite">
        <span>T10</span><strong>취부</strong><p>2026.10.12 07:00–11:00 · 20 MH · 4 작업시간</p>
      </div>
      <div class="gantt-caption">파란 막대는 생산 가능한 시간에만 표시됩니다. 점심(12:00–13:00)과 야간은 작업시간에 포함하지 않으며, 분리된 막대는 같은 작업의 연속 구간입니다.</div>
    </section>`;
}

function taskTable(tasks, crew) {
  const totalPerWorkerHours = tasks.reduce((sum, task) => sum + perWorkerHours(task, crew), 0);
  return `
    <section class="panel schedule-table-panel" aria-labelledby="task-table-title">
      <div class="schedule-section-head schedule-section-head--compact"><div><span class="eyebrow">PROCESS TASKS</span><h2 id="task-table-title">공정 작업표</h2></div><strong class="total-mh">합계 120 MH</strong></div>
      <div class="table-wrap schedule-table-wrap"><table><thead><tr><th>코드</th><th>작업명</th><th>계획 시작</th><th>계획 종료</th><th>잔여 MH</th><th title="잔여 MH를 현재 투입 인원으로 나눈 값">인당 작업시간 (${crew}명 기준)</th></tr></thead><tbody>
        ${tasks.map((task) => `<tr><td><strong>${task.id}</strong></td><td>${task.label}</td><td>${formatDateTime(task.start)}</td><td>${formatDateTime(task.end)}</td><td>${task.remaining_mh} MH</td><td>${perWorkerHours(task, crew)}h</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="4">정상 잔여 작업 합계</td><td>120 MH</td><td>${totalPerWorkerHours}h</td></tr></tfoot></table></div>
      <p class="schedule-table-note">5명 동일 투입 기준으로 잔여 MH를 투입 인원으로 나눈 인당 정규 작업시간입니다.</p>
    </section>`;
}

function supportPanels(project) {
  const overview = project.overview;
  return `
    <div class="schedule-support-grid">
      <section class="panel capacity-panel" aria-labelledby="capacity-title">
        <div class="schedule-section-head schedule-section-head--compact"><div><span class="eyebrow">WORKFORCE & CAPACITY</span><h2 id="capacity-title">인력 및 정규 생산능력</h2></div></div>
        <div class="capacity-equation" aria-label="5명 곱하기 하루 8시간 곱하기 3일은 120 MH">
          <div><strong>${overview.crew}</strong><span>작업자</span></div><b>×</b><div><strong>${overview.hoursPerDay}</strong><span>시간/일</span></div><b>×</b><div><strong>${overview.workdays}</strong><span>잔여 일수</span></div><b>=</b><div class="capacity-equation__result"><strong>${overview.regularCapacityMH}</strong><span>가용 MH</span></div>
        </div>
        <div class="capacity-balance"><span>정규 가용 능력 <strong>120 MH</strong></span><span>잔여 필요 작업 <strong>120 MH</strong></span><span class="is-zero">여유 <strong>0시간</strong></span></div>
        <p>하루 8시간은 오전 07:00–12:00와 오후 13:00–16:00의 합계이며 점심시간은 제외됩니다.</p>
      </section>
      <section class="panel inspection-gate-panel" aria-labelledby="gate-title">
        <div class="schedule-section-head schedule-section-head--compact"><div><span class="eyebrow">INSPECTION GATE</span><h2 id="gate-title">최초 검사 게이트</h2></div><span class="gate-time">10.14 15:00–16:00</span></div>
        <div class="gate-content">${icon('shield')}<div><strong>연속 1시간 작업 슬롯</strong><p>T40 최초 검사 대응은 참조 마감 직전 1시간으로 배치됩니다. 실제 QC 예약 또는 승인이 확정됐다는 의미는 아닙니다.</p></div></div>
      </section>
      <section class="panel buffer-panel" aria-labelledby="buffer-title">
        <div class="schedule-section-head schedule-section-head--compact"><div><span class="eyebrow">BUFFER EXPLANATION</span><h2 id="buffer-title">정규 일정 여유 0시간</h2></div><span class="buffer-zero">0h</span></div>
        <p>정규 가용 능력 120 MH와 잔여 정상 작업 120 MH가 정확히 같고, 마지막 T40 작업이 2026.10.14 16:00 참조 마감에 끝납니다.</p>
        <div class="buffer-note">${icon('info')} 최초 기준 변경 이력이 제공되지 않았으므로, 여유 소진의 역사적 원인은 검증된 사실로 설명하지 않습니다.</div>
      </section>
    </div>`;
}

export function renderSchedulePage(state, project) {
  if (state.selectedBlock !== 'B-203') return renderSelectionState(state);
  return `
    <div class="schedule-page">
      <section class="schedule-hero">
        <div><span class="eyebrow">PRODUCTION PLANNING & SCHEDULE</span><h1>B-203 생산 계획 및 일정</h1><p>정규 작업 캘린더를 반영한 120 MH 기준 잔여 작업 계획</p></div>
        <div class="schedule-hero__status"><span>기준 진도율</span><strong>${project.overview.displayProgressPct}%</strong><small>합성 시연 기준</small></div>
      </section>
      <div class="schedule-summary" aria-label="B-203 일정 요약">${summaryCards(project)}</div>
      ${renderGantt(project)}
      ${supportPanels(project)}
      ${taskTable(project.workSequence.steps, project.overview.crew)}
      <div class="data-notice">${icon('info')} 본 일정은 제공된 v2 프로젝트 데이터의 정상 잔여 작업 배치이며, 실제 조선소 작업 실적이나 위험 시뮬레이션 결과가 아닙니다.</div>
    </div>`;
}

export function bindSchedulePage(root, store, project) {
  root.querySelector('[data-go-overview]')?.addEventListener('click', () => store.setPage('overview'));
  const detail = root.querySelector('[data-gantt-detail]');
  if (!detail) return;

  const tasks = new Map(project.workSequence.steps.map((task) => [task.id, task]));
  root.querySelectorAll('[data-gantt-task]').forEach((button) => {
    button.addEventListener('click', () => {
      const task = tasks.get(button.dataset.ganttTask);
      if (!task) return;
      root.querySelectorAll('[data-gantt-task]').forEach((segment) => {
        segment.classList.toggle('is-selected', segment.dataset.ganttTask === task.id);
      });
      detail.innerHTML = `<span>${task.id}</span><strong>${task.label}</strong><p>${formatDateTime(task.start)}–${formatDateTime(task.end)} · ${task.remaining_mh} MH · ${task.duration_work_h} 작업시간</p>`;
    });
  });
}
