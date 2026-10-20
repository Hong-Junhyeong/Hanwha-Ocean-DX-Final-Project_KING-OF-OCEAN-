import { panelHeader } from './layout.js';
import { getInspectionRecordsForSelection } from '../data/projectData.js';

const typeLabel = { WELD: '용접', FITUP: '취부·정합', DIMENSION: '치수·형상' };

function tableRows(records) {
  return records.map((record) => `
    <tr>
      <td>${record.inspectionId}</td>
      <td>${record.inspectionDate}</td>
      <td>${typeLabel[record.type] || record.type}</td>
      <td>${record.process}</td>
      <td><span class="result result--${record.result.toLowerCase()}">${record.result === 'PASS' ? '적합' : '불합격'}</span></td>
      <td>${record.reworkRequired ? `필요 ${record.reworkMH}MH` : '불필요'}</td>
      <td>미매핑</td>
    </tr>`).join('');
}

export function renderInspectionHistory(state, records) {
  const filtered = getInspectionRecordsForSelection(records, state);
  const isB203 = state.selectedBlock === 'B-203';
  const title = isB203 ? '대조립 합성 참고 검사 이력 (최근 50건)' : '검사 상세 이력 (최근 50건)';
  const scopeText = isB203 ? 'B-203 분석용 역사 참고 · 블록 ID 미매핑' : '선택 기반 조회';
  let body;

  if (isB203) {
    body = `
      <div class="inspection-reference-note">이 표는 B-203 분석에 참고하는 대조립 합성 최초검사 이력입니다. 개별 행은 B-203 확정 검사 이벤트가 아니며 블록 ID는 미매핑 상태로 유지됩니다.</div>
      <div class="pending-inspection" aria-label="B-203 향후 검사 체크포인트">
        <strong>향후 검사 체크포인트 50건</strong>
        <span>용접 27</span><span>취부·정합 15</span><span>치수·형상 8</span>
        <small>완료 이력과 분리된 계획 수량</small>
      </div>
      <div class="table-wrap"><table><thead><tr><th>검사 ID</th><th>일자</th><th>검사 항목</th><th>검사 구역</th><th>결과</th><th>보수</th><th>시설/블록</th></tr></thead><tbody>${tableRows(filtered)}</tbody></table></div>`;
  } else if (!state.selectedFacility) {
    body = `<div class="empty-table-state">검사 이력을 확인하려면 공정 또는 블록을 선택해 주세요.<small>전체 야드 상태에서는 합성 검사 기록을 자동 표시하지 않습니다.</small></div>`;
  } else {
    body = `<div class="empty-table-state">선택한 공정의 검사 상세 이력이 연결되지 않았습니다.<small>B-203 외 시설·블록에는 검증된 매핑 데이터가 없습니다.</small></div>`;
  }
  return `
    <section class="panel inspection-panel" aria-labelledby="inspection-title">
      ${panelHeader(`<span id="inspection-title">${title}</span>`, `<span class="scope-pill">${scopeText}</span>`)}
      ${body}
    </section>
  `;
}
