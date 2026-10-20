import { icon } from './icons.js';
import { panelHeader } from './layout.js';
import { getIssues } from '../data/projectData.js';

const categories = [
  ['ALL', '전체'], ['QUALITY', '품질'], ['SCHEDULE', '일정'], ['EQUIPMENT', '설비'], ['MATERIAL', '자재'],
];

function issueRows(issues, selectedId) {
  return issues.map((issue) => `<button type="button" class="issue-row ${selectedId === issue.id ? 'is-selected' : ''}" data-issue="${issue.id}">
    <span class="issue-tag issue-tag--${issue.category.toLowerCase()}">${issue.label}</span>
    <span class="issue-row__content"><strong>${issue.content}</strong><small>${issue.stateLabel}</small></span>
    <span>${issue.facility}</span>
    ${icon('chevron')}
  </button>`).join('');
}

export function renderAlertsPanel(state, project) {
  const allIssues = getIssues(project, state);
  const issues = state.issueCategory === 'ALL' ? allIssues : allIssues.filter((item) => item.category === state.issueCategory);
  const selected = allIssues.find((item) => item.id === state.selectedIssueId);
  const body = issues.length
    ? `<div class="issue-list" role="list">${issueRows(issues, state.selectedIssueId)}</div>${selected ? `<div class="issue-detail"><strong>${selected.stateLabel}</strong><p>${selected.detail}</p></div>` : ''}`
    : `<div class="empty-issues">${icon('info')}<strong>표시할 연결 이슈 데이터가 없습니다.</strong><p>${state.selectedBlock === 'B-203' ? '선택한 분류에 해당하는 B-203 시나리오가 없습니다.' : '초기 화면과 시설 단계에서는 확정된 프로젝트 공통 이슈를 임의로 만들지 않습니다.'}</p></div>`;
  return `
    <section class="panel alerts-panel" aria-labelledby="alerts-title">
      ${panelHeader('<span id="alerts-title">알림 및 이슈 현황</span>', '<span class="scope-pill">상태 구분 적용</span>')}
      <div class="issue-filters" role="group" aria-label="이슈 분류">${categories.map(([id,label]) => `<button type="button" class="${state.issueCategory === id ? 'is-active' : ''}" data-issue-category="${id}" aria-pressed="${state.issueCategory === id}">${label}</button>`).join('')}</div>
      ${body}
    </section>
  `;
}

export function bindAlertsPanel(root, store) {
  root.querySelectorAll('[data-issue-category]').forEach((button) => {
    button.addEventListener('click', () => store.setIssueCategory(button.dataset.issueCategory));
  });
  root.querySelectorAll('[data-issue]').forEach((button) => {
    button.addEventListener('click', () => store.selectIssue(button.dataset.issue));
  });
}
