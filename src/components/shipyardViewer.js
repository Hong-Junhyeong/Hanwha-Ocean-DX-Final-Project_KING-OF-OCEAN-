import { icon } from './icons.js';
import { panelHeader } from './layout.js';
import { readAppliedPlayback } from './riskPage.js';
import { connectProductionViewer } from '../viewer/bridge.js';
const LOCAL_VIEWER_URL=`${import.meta.env.BASE_URL}3d/assembly_factory_v9.html`;
let disconnectViewer=null;
export function disposeShipyardViewer(){disconnectViewer?.();disconnectViewer=null;}

export const VIEWER_MODES = Object.freeze({
  YARD_OVERVIEW: 'YARD_OVERVIEW',
  B203_DETAIL_3D: 'B203_DETAIL_3D',
});

const hotspots = [
  { kind: 'facility', id: 'A_ZONE', label: 'A구역', sub: '선행의장', x: 25, y: 33 },
  { kind: 'facility', id: 'B_ZONE', label: 'B구역', sub: '대조립 공장', x: 54, y: 48 },
  { kind: 'facility', id: 'C_ZONE', label: 'C구역', sub: '도장', x: 68, y: 27 },
  { kind: 'facility', id: 'D_ZONE', label: 'D구역', sub: '탑재', x: 87, y: 25 },
  { kind: 'facility', id: 'E_ZONE', label: 'E구역', sub: '자재/물류', x: 14, y: 58 },
  { kind: 'block', id: 'B-201', label: 'B-201', x: 37.5, y: 66 },
  { kind: 'block', id: 'B-202', label: 'B-202', x: 47.6, y: 66 },
  { kind: 'block', id: 'B-203', label: 'B-203', x: 57.8, y: 66 },
  { kind: 'block', id: 'B-204', label: 'B-204', x: 67.9, y: 66 },
];

let cssFullscreen = false;
let globalFullscreenEventsBound = false;
let desiredScrollPosition = null;

function restoreViewerScroll() {
  if (desiredScrollPosition === null) return;
  document.documentElement.scrollTop = desiredScrollPosition;
  document.body.scrollTop = desiredScrollPosition;
}

export function activateB203Detail(store) {
  desiredScrollPosition = window.scrollY;
  store.setViewerMode(VIEWER_MODES.B203_DETAIL_3D);
  requestAnimationFrame(restoreViewerScroll);
  window.setTimeout(restoreViewerScroll, 120);
  window.setTimeout(() => {
    restoreViewerScroll();
    desiredScrollPosition = null;
  }, 700);
}

function hotspotButton(item, state) {
  const selected = item.kind === 'block'
    ? state.selectedBlock === item.id
    : state.selectedFacility === item.id && !state.selectedBlock;
  const className = `map-hotspot map-hotspot--${item.kind} ${selected ? 'is-selected' : ''}`;
  const sub = item.sub ? `<small>${item.sub}</small>` : '';
  const data = item.kind === 'block' ? `data-block="${item.id}"` : `data-facility="${item.id}"`;
  return `<button type="button" class="${className}" style="--x:${item.x}%;--y:${item.y}%" ${data} aria-pressed="${selected}"><span>${item.label}</span>${sub}</button>`;
}

function fullscreenButton() {
  return `<button type="button" class="viewer-tool" data-viewer-fullscreen aria-label="뷰어 전체화면으로 보기">${icon('expand')}<span>전체화면</span></button>`;
}

function yardControls() {
  return `<div class="viewer-actions">
    <div class="segmented" aria-label="야드 보기 범위">
      <button type="button" class="is-active" data-yard-view="ALL" aria-label="전체 야드 보기 및 선택 초기화">${icon('reset')} 전체 야드</button>
    </div>
    ${fullscreenButton()}
  </div>`;
}

function detailControls() {
  return `<div class="viewer-actions">
    <button type="button" class="viewer-tool viewer-tool--return" data-return-yard>${icon('arrowLeft')}<span>전체 야드로 돌아가기</span></button>
    ${fullscreenButton()}
  </div>`;
}

function yardView(state) {
  return `<div class="yard-map" data-view="ALL">
    <img src="./assets/shipyard-overview.png" alt="시설 선택용 개념 조선소 야드 이미지. 실제 거제조선소 실측 배치가 아닙니다." />
    <div class="yard-map__shade" aria-hidden="true"></div>
    ${hotspots.map((item) => hotspotButton(item, state)).join('')}
    <div class="yard-map__caption">개념 배치도 · 실제 조선소 실측 배치 아님</div>
  </div>`;
}

function detailView() {
  return `<div class="b203-viewer" data-b203-viewer>
    <div class="b203-viewer__loading" data-frame-loading role="status">B-203 상세 3D 화면을 불러오는 중입니다.</div>
    <iframe
      class="b203-viewer__frame"
      data-b203-frame
      src="${LOCAL_VIEWER_URL}"
      title="B-203 로컬 생산 데이터 연동 3D 뷰어"
      allow="fullscreen"
      allowfullscreen
      loading="eager"
    ></iframe>
    <div class="b203-viewer__fallback" data-frame-fallback hidden>
      <strong>로컬 3D 화면을 불러오지 못했습니다.</strong>
      <p>개발 서버 실행 상태와 브라우저의 WebGL 지원을 확인해 주세요. 전체 야드로 돌아가 다시 열 수 있습니다.</p>
    </div>
  </div>`;
}

export function renderShipyardViewer(state) {
  const detailActive = state.viewerMode === VIEWER_MODES.B203_DETAIL_3D && state.selectedBlock === 'B-203';
  const title = detailActive
    ? '<span id="yard-title">B-203 상세 3D 뷰어</span><small class="viewer-mode-label">로컬 · 현재 적용 생산 시나리오</small>'
    : '<span id="yard-title">조선소 야드 현황도</span>';
  return `<section class="panel yard-panel ${cssFullscreen ? 'is-css-fullscreen' : ''}" data-viewer-panel data-viewer-mode="${detailActive ? VIEWER_MODES.B203_DETAIL_3D : VIEWER_MODES.YARD_OVERVIEW}" aria-labelledby="yard-title">
    ${panelHeader(title, detailActive ? detailControls() : yardControls())}
    <div class="viewer-stage">${detailActive ? detailView() : yardView(state)}</div>
  </section>`;
}

function updateFullscreenControls(root) {
  const panel = root.querySelector('[data-viewer-panel]');
  if (!panel) return;
  const active = document.fullscreenElement === panel || panel.classList.contains('is-css-fullscreen');
  // Same-origin presentation flag only; production PLAN/STATE messaging is untouched.
  const frame = panel.querySelector('[data-b203-frame]');
  const child = frame?.contentDocument?.documentElement;
  if (child) {
    const entering = active && !child.classList.contains('is-viewer-fullscreen');
    child.classList.toggle('is-viewer-fullscreen', active);
    if (entering) frame.contentWindow.scrollTo(0, 0);
  }
  const button = panel.querySelector('[data-viewer-fullscreen]');
  if (!button) return;
  button.innerHTML = `${icon(active ? 'collapse' : 'expand')}<span>${active ? '전체화면 종료' : '전체화면'}</span>`;
  button.setAttribute('aria-label', active ? '뷰어 전체화면 종료' : '뷰어 전체화면으로 보기');
}

function ensureGlobalFullscreenEvents(root) {
  if (globalFullscreenEventsBound) return;
  globalFullscreenEventsBound = true;
  document.addEventListener('fullscreenchange', () => updateFullscreenControls(document));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && cssFullscreen) {
      cssFullscreen = false;
      document.querySelector('[data-viewer-panel]')?.classList.remove('is-css-fullscreen');
      updateFullscreenControls(document);
    }
  });
  updateFullscreenControls(root);
}

async function toggleFullscreen(panel, root) {
  if (document.fullscreenElement === panel) {
    await document.exitFullscreen();
    return;
  }
  if (panel.classList.contains('is-css-fullscreen')) {
    cssFullscreen = false;
    panel.classList.remove('is-css-fullscreen');
    updateFullscreenControls(root);
    return;
  }
  if (panel.requestFullscreen) {
    try {
      await panel.requestFullscreen();
      return;
    } catch (error) {
      console.warn('Native fullscreen unavailable; using CSS fallback.', error);
    }
  }
  cssFullscreen = true;
  panel.classList.add('is-css-fullscreen');
  updateFullscreenControls(root);
}

function selectionWithFullscreenRestore(root, store, action) {
  const panel = root.querySelector('[data-viewer-panel]');
  const nativeFullscreen = document.fullscreenElement === panel;
  action();
  if (nativeFullscreen) {
    const replacement = root.querySelector('[data-viewer-panel]');
    replacement?.requestFullscreen?.().catch(() => {
      cssFullscreen = true;
      replacement?.classList.add('is-css-fullscreen');
      updateFullscreenControls(root);
    });
  }
}

export function bindShipyardViewer(root, store, project, records) {
  disposeShipyardViewer();
  ensureGlobalFullscreenEvents(root);
  const panel = root.querySelector('[data-viewer-panel]');
  if (!panel) return;

  root.querySelectorAll('[data-facility]').forEach((button) => {
    button.addEventListener('click', () => selectionWithFullscreenRestore(root, store, () => store.selectFacility(button.dataset.facility)));
  });
  root.querySelectorAll('[data-block]').forEach((button) => {
    button.addEventListener('click', () => selectionWithFullscreenRestore(root, store, () => store.selectBlock(button.dataset.block)));
  });
  root.querySelector('[data-yard-view]')?.addEventListener('click', (event) => {
    selectionWithFullscreenRestore(root, store, () => store.setYardView(event.currentTarget.dataset.yardView));
  });
  root.querySelector('[data-return-yard]')?.addEventListener('click', () => store.setViewerMode(VIEWER_MODES.YARD_OVERVIEW));
  root.querySelector('[data-viewer-fullscreen]')?.addEventListener('click', () => toggleFullscreen(panel, root));

  const frame = root.querySelector('[data-b203-frame]');
  if (frame) {
    disconnectViewer=connectProductionViewer(frame,()=>readAppliedPlayback(project,records),{onStatus:(code,message)=>{
      const loading=root.querySelector('[data-frame-loading]');
      if(loading){loading.textContent=message;loading.hidden=code==='READY';}
      frame.dataset.connection=code;
    }});
    frame.addEventListener('load', () => {
      frame.dataset.loaded = 'true';
      updateFullscreenControls(root);
      window.setTimeout(restoreViewerScroll, 0);
    });
    frame.addEventListener('error', () => {
      root.querySelector('[data-frame-loading]')?.setAttribute('hidden', '');
      root.querySelector('[data-frame-fallback]')?.removeAttribute('hidden');
      frame.setAttribute('hidden', '');
    });
  }
  updateFullscreenControls(root);
}
