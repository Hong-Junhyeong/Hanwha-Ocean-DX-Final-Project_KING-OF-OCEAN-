import { icon } from './icons.js';
import { panelHeader } from './layout.js';
import { assemblySteps, facilities, facilityCards } from '../data/projectData.js';
import { activateB203Detail } from './shipyardViewer.js';

function initialContent() {
  return `
    <div class="selection-empty">
      <div class="selection-empty__icon">${icon('cursor')}</div>
      <div>
        <h3>조선소 야드에서 시설을 선택해 주세요.</h3>
        <p>야드 내 시설을 클릭하면 해당 공정의 생산 현황, 일정, 품질 및 위험 정보를 확인할 수 있습니다.</p>
      </div>
    </div>
    <div class="subsection-title"><span></span>주요 시설 현황 (전체)</div>
    <div class="facility-cards">
      ${facilityCards.map((card) => `<article class="facility-card">${icon(card.icon)}<strong>${card.name}</strong><span>${card.role}</span></article>`).join('')}
    </div>
    <div class="inline-note">${icon('info')} 시설을 선택하면 우측 정보와 하단 데이터가 동일한 선택 상태로 변경됩니다.</div>
  `;
}

function blockTabs(state) {
  return `<div class="block-tabs" role="tablist" aria-label="B구역 블록 선택">${['B-201','B-202','B-203','B-204'].map((id) => `<button type="button" role="tab" class="${state.selectedBlock === id ? 'is-active' : ''}" aria-selected="${state.selectedBlock === id}" data-block-tab="${id}">${id}</button>`).join('')}</div>`;
}

function b203Metrics(project) {
  const data = project.overview;
  const metrics = [
    ['전체 진도율', `${data.displayProgressPct}%`],
    ['잔여 작업량', `${data.normalRemainingMH} MH`],
    ['작업 인원', `${data.crew}명`],
    ['정규 일정 여유', `${data.regularBufferHours}시간`],
    ['인계 목표', '2026.10.14 16:00'],
  ];
  return `<div class="metric-grid">${metrics.map(([label,value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>`;
}

function processSteps() {
  return `
    <div class="process-head"><strong>대조립 7단계 공정</strong><span>단계별 진척률 미제공</span></div>
    <ol class="process-steps">${assemblySteps.map((step, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><p>${step.label}</p></li>`).join('')}</ol>
  `;
}

function selectedFacilityContent(state, project) {
  const facility = facilities[state.selectedFacility];
  if (!facility) return initialContent();
  const isBZone = facility.id === 'B_ZONE';
  let blockContent = '';

  if (isBZone && state.selectedBlock === 'B-203') {
    blockContent = `
      <div class="selected-block-head"><div><span class="eyebrow">BLOCK SELECTED</span><h3>B-203 생산 기준 정보</h3></div><span class="status-badge status-badge--risk">버퍼 0h</span></div>
      ${b203Metrics(project)}
      ${processSteps()}
      <button class="detail-button" type="button" data-open-b203-viewer>상세 보기 ${icon('chevron')}</button>
    `;
  } else if (isBZone && state.selectedBlock) {
    blockContent = `
      <div class="selected-block-head"><div><span class="eyebrow">BLOCK SELECTED</span><h3>${state.selectedBlock}</h3></div><span class="status-badge">데이터 미연결</span></div>
      <div class="missing-state">${state.selectedBlock}의 생산 수치와 검사 이력은 제공된 v2 데이터에 없습니다. B-203 값을 복사해 표시하지 않습니다.</div>
    `;
  } else if (isBZone) {
    blockContent = `
      <div class="missing-state missing-state--neutral">B-201~B-204 중 블록을 선택해 주세요. B구역 선택만으로 B-203 수치는 표시되지 않습니다.</div>
    `;
  }

  return `
    <div class="facility-summary">
      <div class="facility-summary__title"><span class="eyebrow">FACILITY SELECTED</span><h3>${facility.name}</h3></div>
      <dl>
        <div><dt>공정 분류</dt><dd>${facility.process}</dd></div>
        <div><dt>생산 역할</dt><dd>${facility.role}</dd></div>
        <div><dt>연계 공정</dt><dd>${facility.flow}</dd></div>
        <div><dt>데이터 상태</dt><dd>${facility.availability}</dd></div>
      </dl>
    </div>
    ${isBZone ? blockTabs(state) : ''}
    ${blockContent}
  `;
}

export function renderFacilityPanel(state, project) {
  return `
    <section class="panel facility-panel" aria-labelledby="facility-title">
      ${panelHeader('<span id="facility-title">시설 선택 정보</span>')}
      <div class="facility-panel__body">${selectedFacilityContent(state, project)}</div>
    </section>
  `;
}

export function bindFacilityPanel(root, store) {
  root.querySelectorAll('[data-block-tab]').forEach((button) => {
    button.addEventListener('click', () => store.selectBlock(button.dataset.blockTab));
  });
  root.querySelector('[data-open-b203-viewer]')?.addEventListener('click', (event) => {
    event.currentTarget.blur();
    activateB203Detail(store);
  });
}
