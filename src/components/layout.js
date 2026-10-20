import { icon } from './icons.js';
export function renderHeader(state={}) {
 return `<header class="topbar"><div class="brand"><div class="brand__identity"><img src="./assets/hanwha-ocean-logo.svg" alt="Hanwha Ocean" class="brand__logo"/><span class="brand__caption" aria-hidden="true"><strong>Hanwha Ocean</strong><small>Shipyard Production Management</small></span></div><div class="brand__divider"></div><div class="brand__copy"><h1>생산관리 통합 관리 시스템</h1><p>생산·납기·품질·위험 대응을 위한 통합 관리</p></div></div><div class="topbar__meta"><span class="meta-chip">${icon('calendar')} 2026.10.12 07:00</span><span class="meta-chip meta-chip--synthetic">합성 시연 데이터</span></div></header>`;
}
export function renderAppFrame(sidebar,content,state){return `${renderHeader(state)}<div class="app-shell">${sidebar}<main id="main-content" class="main-content" tabindex="-1">${content}</main></div>`;}
export function panelHeader(title,action=''){return `<div class="panel__header"><h2>${title}</h2>${action}</div>`;}
export function dataNotice(){return `<div class="data-notice">${icon('info')} 생산·검사 수치는 실제 조선소 실적이 아닌 프로젝트 합성 시연 데이터입니다.</div>`;}
