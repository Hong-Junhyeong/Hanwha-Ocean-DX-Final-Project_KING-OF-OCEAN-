import {qualitySections,summaryRows} from './qualityAnalytics.js';
import {downloadTable} from '../export/workbook.js';
import { icon } from './icons.js';
import { facilities } from '../data/projectData.js';

const typeLabels = { ALL: '전체', WELD: '용접', FITUP: '취부·정합', DIMENSION: '치수·형상' };
const dispositionLabels = { ACCEPTED: '승인', REPAIR_REQUIRED: '보수 필요' };

let qualityRefreshing=false;
const qualityUi = {
  period: '12M', summaryView:'SUMMARY', metric:'failures',scatterType:'WELD',predictionMode:'12M',weight6:.7, targets:{WELD:null,FITUP:null,DIMENSION:null},showLimits:true,
  type: 'ALL',
  selectedMonth: null,
  search: '',
  dateFrom: '',
  dateTo: '',
  tableType: 'ALL',
  result: 'ALL',
  rework: 'ALL',
  sort: 'date-desc',
  page: 1,
  pageSize: 25,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function percent(value) {
  return `${(value * 100).toFixed(value * 100 % 1 === 0 ? 1 : 2)}%`;
}

function selectionName(state) {
  return state.selectedBlock || facilities[state.selectedFacility]?.name || '선택 없음';
}

function selectionState(state) {
  let title = '품질 분석 대상이 선택되지 않았습니다.';
  let description = 'Overview에서 시설 또는 블록을 선택해 주세요. 상세 품질 분석 데이터는 B-203 선택 시에만 제공됩니다.';
  if (state.selectedFacility === 'B_ZONE' && !state.selectedBlock) {
    title = 'B구역에서 분석할 블록을 선택해 주세요.';
    description = 'B구역 전체에 B-203 합성 이력을 자동 적용하지 않습니다. Overview에서 B-203을 선택해 주세요.';
  } else if (state.selectedFacility) {
    title = `${selectionName(state)} 품질 데이터 미연결`;
    description = '선택한 시설 또는 블록에는 검증된 품질 이력이 연결되지 않았습니다. B-203 자료를 복사해 표시하지 않습니다.';
  }
  return `<section class="quality-empty" aria-labelledby="quality-empty-title">
    <div class="schedule-empty__icon">${icon('shield')}</div>
    <span class="eyebrow">SELECTION REQUIRED</span>
    <h2 id="quality-empty-title">${title}</h2>
    <p>${description}</p>
    <button type="button" class="overview-action" data-go-overview>${icon('home')} Overview로 이동</button>
    <div class="schedule-empty__boundary">${icon('info')} 현재 전체 품질 분석은 B-203 분석용 합성 대조립 이력에만 연결되어 있습니다.</div>
  </section>`;
}

function periodRecords(records) {
  const months = [...new Set(records.map((record) => record.month))].sort();
  const activeMonths = new Set(qualityUi.period === '6M' ? months.slice(-6) : months);
  return records.filter((record) => activeMonths.has(record.month));
}

function analyticalRecords(records) {
  return periodRecords(records).filter((record) => qualityUi.type === 'ALL' || record.type === qualityUi.type);
}

function summarize(records) {
  const inspections = records.length;
  const failures = records.filter((record) => record.result === 'FAIL').length;
  const reworks = records.filter((record) => record.reworkRequired).length;
  return {
    inspections,
    failures,
    reworks,
    failRate: inspections ? failures / inspections : 0,
    reworkRate: inspections ? reworks / inspections : 0,
  };
}

function monthlyStats(records) {
  const months = [...new Set(periodRecords(records).map((record) => record.month))].sort();
  const filtered = analyticalRecords(records);
  return months.map((month) => {
    const rows = filtered.filter((record) => record.month === month);
    return { month, ...summarize(rows) };
  });
}

function filterButton(group, value, label, current) {
  return `<button type="button" class="${current === value ? 'is-active' : ''}" data-quality-${group}="${value}" aria-pressed="${current === value}">${label}</button>`;
}

function qualityHeader() {
  return `<section class="quality-hero">
    <div>
      <span class="eyebrow">QUALITY MANAGEMENT</span>
      <h1>품질 관리 현황</h1>
      <p>개별 행은 합성 최초검사 체크포인트이며 B-203에서 실제 발생한 확정 검사 이벤트가 아닙니다.</p>
    </div>
    <div class="quality-filters" aria-label="품질 분석 필터">
      <fieldset><legend>분석 기간</legend><div>${filterButton('period', '12M', '12개월', qualityUi.period)}${filterButton('period', '6M', '최근 6개월', qualityUi.period)}</div></fieldset>
      <fieldset><legend>검사 유형</legend><div>${Object.entries(typeLabels).map(([value, label]) => filterButton('type', value, label, qualityUi.type)).join('')}</div></fieldset>
    </div>
  </section>`;
}

function kpiCards(records) {
  const stats = summarize(records);
  const periodLabel = qualityUi.period === '6M' ? '최근 6개월' : '12개월';
  const cards = [
    ['최초 검사 체크포인트', stats.inspections.toLocaleString('ko-KR'), '건'],
    ['최초 불합격', stats.failures.toLocaleString('ko-KR'), '건'],
    ['최초 불합격률', percent(stats.failRate), '전체 최초검사 기준'],
    ['보수 필요', stats.reworks.toLocaleString('ko-KR'), '건'],
    ['보수 필요율', percent(stats.reworkRate), '전체 최초검사 기준'],
  ];
  return `<div class="quality-kpis" aria-label="${periodLabel} 품질 요약">${cards.map(([label, value, unit], index) => `<article class="quality-kpi ${index === 2 || index === 4 ? 'quality-kpi--rate' : ''}"><span>${label}</span><strong>${value}</strong><small>${periodLabel} · ${unit}</small></article>`).join('')}</div>`;
}

function trendChart(stats) {
  const width = 920;
  const height = 300;
  const left = 52;
  const right = 54;
  const top = 26;
  const bottom = 48;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxCount = Math.max(10, ...stats.map((item) => item.inspections));
  const maxRate = Math.max(0.08, ...stats.flatMap((item) => [item.failRate, item.reworkRate])) * 1.18;
  const step = plotWidth / Math.max(stats.length, 1);
  const countY = (value) => top + plotHeight - (value / maxCount) * plotHeight;
  const rateY = (value) => top + plotHeight - (value / maxRate) * plotHeight;
  const x = (index) => left + step * index + step / 2;
  const failPoints = stats.map((item, index) => `${x(index)},${rateY(item.failRate)}`).join(' ');
  const reworkPoints = stats.map((item, index) => `${x(index)},${rateY(item.reworkRate)}`).join(' ');
  const grid = [0, .25, .5, .75, 1].map((ratio) => {
    const y = top + plotHeight * (1 - ratio);
    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" class="chart-grid"/><text x="${left - 9}" y="${y + 4}" text-anchor="end">${Math.round(maxCount * ratio)}</text><text x="${width - right + 9}" y="${y + 4}" text-anchor="start">${(maxRate * ratio * 100).toFixed(1)}%</text>`;
  }).join('');
  const marks = stats.map((item, index) => {
    const center = x(index);
    const barWidth = Math.min(32, step * .45);
    const inspectionY = countY(item.inspections);
    const failureY = countY(item.failures);
    const reworkY = countY(item.reworks);
    const title = `${item.month} · 검사 ${item.inspections}건 · 최초 불합격 ${item.failures}건(${percent(item.failRate)}) · 보수 필요 ${item.reworks}건(${percent(item.reworkRate)})`;
    return `<g tabindex="0" role="img" aria-label="${title}"><title>${title}</title>
      <rect x="${center - barWidth / 2}" y="${inspectionY}" width="${barWidth}" height="${top + plotHeight - inspectionY}" rx="3" class="trend-bar trend-bar--inspection"/>
      <rect x="${center - barWidth / 2}" y="${failureY}" width="${barWidth / 2}" height="${top + plotHeight - failureY}" class="trend-bar trend-bar--fail"/>
      <rect x="${center}" y="${reworkY}" width="${barWidth / 2}" height="${top + plotHeight - reworkY}" class="trend-bar trend-bar--rework"/>
      <circle cx="${center}" cy="${rateY(item.failRate)}" r="4.5" class="trend-point trend-point--fail"/>
      <circle cx="${center}" cy="${rateY(item.reworkRate)}" r="4.5" class="trend-point trend-point--rework"/>
      <text x="${center}" y="${height - 18}" text-anchor="middle">${item.month.slice(2).replace('-', '.')}</text>
    </g>`;
  }).join('');
  return `<section class="panel quality-chart-panel" aria-labelledby="trend-title">
    <div class="quality-section-head"><div><span class="eyebrow">MONTHLY TREND</span><h2 id="trend-title">월별 검사량과 품질률 추이</h2></div><div class="quality-legend"><span class="legend-inspection"></span>검사량 <span class="legend-fail"></span>불합격/률 <span class="legend-rework"></span>보수/률</div></div>
    <div class="quality-chart-scroll" tabindex="0"><svg class="quality-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="월별 검사량, 최초 불합격, 보수 필요 및 비율 추이">${grid}<polyline points="${failPoints}" class="trend-line trend-line--fail"/><polyline points="${reworkPoints}" class="trend-line trend-line--rework"/>${marks}</svg></div>
    <p class="quality-chart-note">막대는 건수(좌측 축), 선은 전체 최초검사 대비 비율(우측 축)입니다. 항목에 마우스를 올리거나 키보드로 초점을 이동하면 월별 수치를 확인할 수 있습니다.</p>
  </section>`;
}

function scatterChart(stats) {
  const width = 520;
  const height = 300;
  const left = 56;
  const right = 25;
  const top = 25;
  const bottom = 48;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const rawMinCount = Math.min(...stats.map((item) => item.inspections));
  const rawMaxCount = Math.max(...stats.map((item) => item.inspections));
  const countPadding = Math.max(2, (rawMaxCount - rawMinCount) * .16);
  const minCount = Math.max(0, rawMinCount - countPadding);
  const maxCount = rawMaxCount + countPadding;
  const maxRate = Math.max(.08, ...stats.map((item) => item.failRate)) * 1.15;
  const x = (value) => left + ((value - minCount) / (maxCount - minCount || 1)) * plotWidth;
  const y = (value) => top + plotHeight - (value / maxRate) * plotHeight;
  const grid = [0, .25, .5, .75, 1].map((ratio) => `<line x1="${left}" y1="${top + plotHeight * ratio}" x2="${width - right}" y2="${top + plotHeight * ratio}" class="chart-grid"/>`).join('');
  const coordinateCounts = stats.reduce((counts, item) => {
    const key = `${item.inspections}:${item.failRate}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());
  const coordinateIndexes = new Map();
  const points = stats.map((item) => {
    const selected = qualityUi.selectedMonth === item.month;
    const title = `${item.month} · 검사 ${item.inspections}건 · 최초 불합격 ${item.failures}건(${percent(item.failRate)}) · 보수 ${item.reworks}건(${percent(item.reworkRate)})`;
    const key = `${item.inspections}:${item.failRate}`;
    const duplicateIndex = coordinateIndexes.get(key) || 0;
    coordinateIndexes.set(key, duplicateIndex + 1);
    const duplicateCount = coordinateCounts.get(key);
    const offset = (duplicateIndex - (duplicateCount - 1) / 2) * 24;
    const pointX = x(item.inspections) + offset;
    const pointY = y(item.failRate);
    return `<g class="scatter-mark ${selected ? 'is-selected' : ''}" data-scatter-month="${item.month}" tabindex="0" role="button" aria-label="${title}. 선택하면 이력 표를 해당 월로 제한합니다."><title>${title}</title><circle cx="${pointX}" cy="${pointY}" r="${selected ? 9 : 7}"/><text x="${pointX + 10}" y="${pointY - 8}">${item.month.slice(5)}월</text></g>`;
  }).join('');
  return `<section class="panel quality-scatter-panel" aria-labelledby="scatter-title">
    <div class="quality-section-head"><div><span class="eyebrow">MONTHLY SCATTER</span><h2 id="scatter-title">검사량 대비 최초 불합격률</h2></div>${qualityUi.selectedMonth ? `<button type="button" class="filter-reset" data-clear-month>${qualityUi.selectedMonth} 표 필터 해제</button>` : ''}</div>
    <svg class="scatter-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="월별 검사량과 최초 불합격률 산점도">${grid}<line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" class="chart-axis"/><line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" class="chart-axis"/>${points}<text x="${left + plotWidth / 2}" y="${height - 9}" text-anchor="middle" class="axis-title">월 검사 체크포인트 수</text><text x="16" y="${top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 16 ${top + plotHeight / 2})" class="axis-title">최초 불합격률</text></svg>
    <p class="quality-chart-note">점을 선택하면 아래 상세 이력만 해당 월로 필터링됩니다. 상단 KPI와 다른 차트의 집계 범위는 바뀌지 않습니다. 좌표가 같은 월은 선택을 위해 가로로 미세 분리합니다.</p>
  </section>`;
}

function typeAnalysis(records) {
  const source = periodRecords(records);
  const types = qualityUi.type === 'ALL' ? ['WELD', 'FITUP', 'DIMENSION'] : [qualityUi.type];
  const rows = types.map((type) => {
    const stats = summarize(source.filter((record) => record.type === type));
    const reworkMH = source.filter((record) => record.type === type).reduce((sum, record) => sum + (record.reworkMH || 0), 0);
    return { type, reworkMH, ...stats };
  });
  const max = Math.max(...rows.map((row) => row.inspections), 1);
  return `<section class="panel quality-type-panel" aria-labelledby="type-title">
    <div class="quality-section-head"><div><span class="eyebrow">TYPE ANALYSIS</span><h2 id="type-title">검사 유형별 분석</h2></div></div>
    <div class="type-analysis-list">${rows.map((row) => `<article><div class="type-analysis-name"><strong>${typeLabels[row.type]}</strong><span>${row.inspections}건</span></div><div class="type-bar"><span style="width:${row.inspections / max * 100}%"></span></div><dl><div><dt>최초 불합격</dt><dd>${row.failures}건 · ${percent(row.failRate)}</dd></div><div><dt>보수 필요</dt><dd>${row.reworks}건 · ${percent(row.reworkRate)}</dd></div><div><dt>합성 보수 MH</dt><dd>${row.reworkMH} MH</dd></div></dl></article>`).join('')}</div>
  </section>`;
}

function historyRows(records) {
  let rows = [...analyticalRecords(records)];
  const search = qualityUi.search.trim().toLowerCase();
  if (search) rows = rows.filter((record) => record.inspectionId.toLowerCase().includes(search));
  if (qualityUi.selectedMonth) rows = rows.filter((record) => record.month === qualityUi.selectedMonth);
  if (qualityUi.dateFrom) rows = rows.filter((record) => record.inspectionDate >= qualityUi.dateFrom);
  if (qualityUi.dateTo) rows = rows.filter((record) => record.inspectionDate <= qualityUi.dateTo);
  if (qualityUi.tableType !== 'ALL') rows = rows.filter((record) => record.type === qualityUi.tableType);
  if (qualityUi.result !== 'ALL') rows = rows.filter((record) => record.result === qualityUi.result);
  if (qualityUi.rework !== 'ALL') rows = rows.filter((record) => record.reworkRequired === (qualityUi.rework === 'YES'));
  const [key, direction] = qualityUi.sort.split('-');
  const field = { date: 'inspectionDate', id: 'inspectionId', type: 'type', result: 'result', mh: 'reworkMH' }[key] || 'inspectionDate';
  rows.sort((a, b) => {
    const comparison = typeof a[field] === 'number' ? a[field] - b[field] : String(a[field]).localeCompare(String(b[field]));
    return direction === 'asc' ? comparison : -comparison;
  });
  return rows;
}

function option(value, label, current) {
  return `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`;
}

function historyTable(records) {
  const filtered = historyRows(records);
  const totalPages = Math.max(1, Math.ceil(filtered.length / qualityUi.pageSize));
  qualityUi.page = Math.min(qualityUi.page, totalPages);
  const start = (qualityUi.page - 1) * qualityUi.pageSize;
  const pageRows = filtered.slice(start, start + qualityUi.pageSize);
  return `<section class="panel quality-history-panel" aria-labelledby="quality-history-title">
    <div class="quality-section-head quality-section-head--history"><div><span class="eyebrow">FULL HISTORY</span><h2 id="quality-history-title"><b class="section-number">5</b> 검사 상세 이력</h2><p>합성 최초검사 1,200건 원본 · 블록 ID 미매핑 유지</p></div><div class="v4-actions"><strong>${filtered.length.toLocaleString('ko-KR')}건 일치</strong><button data-history-excel>Excel 다운로드</button></div></div>
    <div class="quality-table-filters">
      <label class="search-field">${icon('search')}<span class="sr-only">검사 ID 검색</span><input type="search" data-history-search value="${escapeHtml(qualityUi.search)}" placeholder="검사 ID 검색" /></label>
      <label><span>시작일</span><input type="date" data-history-from value="${qualityUi.dateFrom}" /></label>
      <label><span>종료일</span><input type="date" data-history-to value="${qualityUi.dateTo}" /></label>
      <label><span>유형</span><select data-history-type>${Object.entries(typeLabels).map(([value, label]) => option(value, label, qualityUi.tableType)).join('')}</select></label>
      <label><span>결과</span><select data-history-result>${option('ALL','전체',qualityUi.result)}${option('PASS','적합',qualityUi.result)}${option('FAIL','불합격',qualityUi.result)}</select></label>
      <label><span>보수</span><select data-history-rework>${option('ALL','전체',qualityUi.rework)}${option('YES','필요',qualityUi.rework)}${option('NO','불필요',qualityUi.rework)}</select></label>
      <label><span>정렬</span><select data-history-sort>${option('date-desc','최신일 순',qualityUi.sort)}${option('date-asc','오래된 순',qualityUi.sort)}${option('id-asc','검사 ID 순',qualityUi.sort)}${option('type-asc','유형 순',qualityUi.sort)}${option('mh-desc','보수 MH 높은 순',qualityUi.sort)}</select></label>
      <button type="button" class="filter-reset" data-clear-history>필터 초기화</button>
    </div>
    ${qualityUi.selectedMonth ? `<div class="table-month-filter">관리도 선택 월: <strong>${qualityUi.selectedMonth}</strong><button type="button" data-clear-month>해제</button></div>` : ''}
    <div class="table-wrap quality-table-wrap"><table><thead><tr><th>검사 ID</th><th>검사일</th><th>월</th><th>공정</th><th>유형</th><th>검사 단위</th><th>최초검사</th><th>결과</th><th>보수</th><th>보수 MH</th><th>처리</th><th>블록 ID</th></tr></thead><tbody>${pageRows.length ? pageRows.map((record) => `<tr><td>${record.inspectionId}</td><td>${record.inspectionDate}</td><td>${record.month}</td><td>${record.process}</td><td>${typeLabels[record.type]}</td><td>${record.inspectionUnit}</td><td>${record.isFirst ? '예' : '아니오'}</td><td><span class="result result--${record.result.toLowerCase()}">${record.result === 'PASS' ? '적합' : '불합격'}</span></td><td>${record.reworkRequired ? '필요' : '불필요'}</td><td>${record.reworkMH}</td><td>${dispositionLabels[record.disposition] || record.disposition}</td><td>${record.blockId ?? '미매핑'}</td></tr>`).join('') : '<tr><td colspan="12" class="quality-no-results">조건에 맞는 검사 이력이 없습니다.</td></tr>'}</tbody></table></div>
    <div class="quality-pagination"><label>페이지당 <select data-page-size>${option('25','25건',String(qualityUi.pageSize))}${option('50','50건',String(qualityUi.pageSize))}</select></label><span>${filtered.length ? start + 1 : 0}–${Math.min(start + qualityUi.pageSize, filtered.length)} / ${filtered.length}</span><div><button type="button" data-page-prev ${qualityUi.page <= 1 ? 'disabled' : ''}>이전</button><strong>${qualityUi.page} / ${totalPages}</strong><button type="button" data-page-next ${qualityUi.page >= totalPages ? 'disabled' : ''}>다음</button></div></div>
  </section>`;
}

function pendingPanel(project) {
  const pending = project.quality.pending50ByType;
  return `<section class="panel quality-pending-panel" aria-labelledby="pending-title">
    <div class="quality-section-head"><div><span class="eyebrow">PENDING CHECKPOINTS</span><h2 id="pending-title">B-203 향후 검사 체크포인트</h2></div><strong>총 ${project.quality.remainingInspectionCount}건</strong></div>
    <div class="pending-quality-grid"><article><span>용접</span><strong>${pending.WELD}</strong><small>계획 체크포인트</small></article><article><span>취부·정합</span><strong>${pending.FITUP}</strong><small>계획 체크포인트</small></article><article><span>치수·형상</span><strong>${pending.DIMENSION}</strong><small>계획 체크포인트</small></article></div>
    <div class="quality-boundary">${icon('info')} 향후 검사 50건은 완료된 역사 이력이나 확정 결함이 아닙니다. 위 1,200건 합성 참고 이력과 별도로 표시합니다.</div>
  </section>`;
}

export function renderQualityPage(state, project, records) {
  if (state.selectedBlock !== 'B-203') return selectionState(state);
  const active = analyticalRecords(records);
  const monthly = monthlyStats(records);
  return `<div class="quality-page" data-quality-root>
    ${qualityHeader()}
    ${qualitySections(records, project, qualityUi)}
    ${historyTable(records)}
    <div class="data-notice">${icon('info')} 이 페이지의 품질 수치는 실제 조선소 실적이 아닌 v2 합성 최초검사 체크포인트 데이터입니다. 최초 불합격과 보수 필요는 중복될 수 있으며 각 비율의 분모는 전체 최초검사입니다.</div>
  </div>`;
}

function resetHistoryFilters() {
  Object.assign(qualityUi, { selectedMonth: null, search: '', dateFrom: '', dateTo: '', tableType: 'ALL', result: 'ALL', rework: 'ALL', sort: 'date-desc', page: 1, pageSize: 25 });
}

export function bindQualityPage(root, store, project, records) {
  root.querySelector('[data-go-overview]')?.addEventListener('click', () => store.setPage('overview'));
  if (!root.querySelector('[data-quality-root]')) return;
  const refresh = () => {
    // Removing a focused input may synchronously emit change/blur. Guard the
    // replacement and flush its value before rendering, preventing reentrant DOM removal.
    if (qualityRefreshing) return;
    const page = root.querySelector('[data-quality-root]');
    if (!page) return;
    qualityRefreshing=true;
    try {
      if(page.contains(document.activeElement))document.activeElement.blur();
      page.outerHTML = renderQualityPage(store.getState(), project, records);
      bindQualityPage(root, store, project, records);
    } finally {qualityRefreshing=false;}
  };
  root.querySelectorAll('[data-scatter-type]').forEach(el=>el.addEventListener('click',()=>{qualityUi.scatterType=el.dataset.scatterType;refresh();}));
  root.querySelector('[data-quality-target]')?.addEventListener('change',e=>{const raw=e.target.value,n=raw===''?null:Number(raw);if(n===null||(Number.isFinite(n)&&n>=0&&n<=100))qualityUi.targets[e.target.dataset.qualityTarget]=n;refresh();});
  root.querySelector('[data-control-limits]')?.addEventListener('change',e=>{qualityUi.showLimits=e.target.checked;refresh();});
  root.querySelectorAll('[data-qa]').forEach(el=>el.addEventListener('change',()=>{qualityUi[el.dataset.qa]=el.value;refresh();}));
  root.querySelector('[data-weight]')?.addEventListener('change',e=>{const n=Number(e.target.value);if(n>=0&&n<=1)qualityUi.weight6=n;refresh();});
  root.querySelector('[data-summary-excel]')?.addEventListener('click',async()=>{try{await downloadTable('전체_품질_현황',['기간','유형','최초 검사','최초 불합격','불합격률','보수 필요','보수 필요율'],summaryRows(records,qualityUi).map(([p,t,s])=>[p,t,s.n,s.failures,s.failRate,s.reworks,s.reworkRate]));}catch(e){alert(e.message);}});
  root.querySelector('[data-history-excel]')?.addEventListener('click',async()=>{try{const r=historyRows(records);await downloadTable('검사_상세_이력',Object.keys(records[0]),r.map(r=>Object.values(r)));}catch(e){alert(e.message);}});
  root.querySelectorAll('[data-quality-period]').forEach((button) => button.addEventListener('click', () => {
    qualityUi.period = button.dataset.qualityPeriod;
    qualityUi.selectedMonth = null;
    qualityUi.page = 1;
    refresh();
  }));
  root.querySelectorAll('[data-quality-type]').forEach((button) => button.addEventListener('click', () => {
    qualityUi.type = button.dataset.qualityType;
    qualityUi.page = 1;
    refresh();
  }));
  const scatter = root.querySelector('.scatter-chart');
  scatter?.addEventListener('click', (event) => {
    const mark = event.target.closest?.('[data-scatter-month]');
    if (!mark) return;
    qualityUi.selectedMonth = mark.dataset.scatterMonth;
    qualityUi.page = 1;
    refresh();
  });
  root.querySelectorAll('[data-scatter-month]').forEach((mark) => {
    mark.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      qualityUi.selectedMonth = mark.dataset.scatterMonth;
      qualityUi.page = 1;
      refresh();
    });
  });
  root.querySelectorAll('[data-clear-month]').forEach((button) => button.addEventListener('click', () => { qualityUi.selectedMonth = null; qualityUi.page = 1; refresh(); }));
  const bindValue = (selector, key, eventName = 'change') => root.querySelector(selector)?.addEventListener(eventName, (event) => { qualityUi[key] = event.target.value; qualityUi.page = 1; refresh(); });
  const searchInput = root.querySelector('[data-history-search]');
  searchInput?.addEventListener('change', (event) => { qualityUi.search = event.target.value; qualityUi.page = 1; refresh(); });
  searchInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    qualityUi.search = event.currentTarget.value;
    qualityUi.page = 1;
    refresh();
  });
  bindValue('[data-history-from]', 'dateFrom');
  bindValue('[data-history-to]', 'dateTo');
  bindValue('[data-history-type]', 'tableType');
  bindValue('[data-history-result]', 'result');
  bindValue('[data-history-rework]', 'rework');
  bindValue('[data-history-sort]', 'sort');
  root.querySelector('[data-page-size]')?.addEventListener('change', (event) => { qualityUi.pageSize = Number(event.target.value); qualityUi.page = 1; refresh(); });
  root.querySelector('[data-page-prev]')?.addEventListener('click', () => { qualityUi.page -= 1; refresh(); });
  root.querySelector('[data-page-next]')?.addEventListener('click', () => { qualityUi.page += 1; refresh(); });
  root.querySelector('[data-clear-history]')?.addEventListener('click', () => { resetHistoryFilters(); refresh(); });
}
