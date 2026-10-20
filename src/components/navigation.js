import { icon } from './icons.js';

const items = [
  { id: 'overview', label: 'Overview', icon: 'home' },
  { id: 'schedule', label: '생산 계획 및 일정', icon: 'chart' },
  { id: 'quality', label: '품질 관리 현황', icon: 'shield' },
  { id: 'risk', label: '위험 시뮬레이션 및 대응안', icon: 'alert' },
];

export function renderNavigation(state) {
  const links = items.map((item) => {
    const active = state.currentPage === item.id;
    return `<button class="nav-item ${active ? 'is-active' : ''}" type="button" aria-label="${item.label}" title="${item.label}" data-page="${item.id}" aria-current="${active ? 'page' : 'false'}">${icon(item.icon)}<span>${item.label}</span></button>`;
  }).join('');

  return `
    <aside class="sidebar" aria-label="주 메뉴">
      <nav class="sidebar__nav">${links}</nav>
      <img class="sidebar-ship" src="./assets/sidebar-ship-photo.png" alt="" aria-hidden="true"/>
      <div class="sidebar-brand" aria-label="Hanwha Ocean · Shipyard Production Management">
        <img src="./assets/hanwha-ocean-logo.svg" alt="" aria-hidden="true"/>
        <div><strong>Hanwha Ocean</strong><span>Shipyard Production Management</span></div>
      </div>
    </aside>
  `;
}

export function bindNavigation(root, store) {
  root.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => { store.setPage(button.dataset.page); window.scrollTo({top:0,behavior:'instant'}); });
  });
}
