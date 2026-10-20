import '@fontsource-variable/noto-sans-kr';
import {pageHeading}from './ui/shared.js';
import {renderRiskPage,bindRiskPage} from './components/riskPage.js';
import './styles/app.css';
import './styles/master.css';
import './styles/responsive.css';
import { createStore } from './state.js';
import { loadProjectData } from './data/projectData.js';
import { renderAppFrame, dataNotice } from './components/layout.js';
import { renderNavigation, bindNavigation } from './components/navigation.js';
import { renderShipyardViewer, bindShipyardViewer, disposeShipyardViewer } from './components/shipyardViewer.js';
import { renderFacilityPanel, bindFacilityPanel } from './components/facilityPanel.js';
import { renderInspectionHistory } from './components/inspectionHistory.js';
import { renderAlertsPanel, bindAlertsPanel } from './components/alertsPanel.js';
import { renderFuturePage } from './components/futurePages.js';
import { renderSchedulePage, bindSchedulePage } from './components/schedulePage.js';
import { renderQualityPage, bindQualityPage } from './components/qualityPage.js';
import { createSplash } from './ui/splash.js';

const app = document.querySelector('#app');
const store = createStore();
const splash = createSplash();

function errorView(error) {
  app.innerHTML = '<div class="error-screen"><h1>데이터를 불러오지 못했습니다.</h1><p></p><button type="button">다시 시도</button></div>';
  app.querySelector('p').textContent=error.message;
  app.querySelector('button').addEventListener('click',()=>window.location.reload(),{once:true});
}

function overviewPage(state, data) {
  return `
    ${pageHeading('Overview','고정 야드 이미지에서 시설과 블록을 선택해 생산 현황을 확인합니다.')}
    <div class="overview-grid">
      ${renderShipyardViewer(state)}
      ${renderFacilityPanel(state, data.project)}
      ${renderInspectionHistory(state, data.inspectionRecords)}
      ${renderAlertsPanel(state, data.project)}
    </div>
    ${dataNotice()}
  `;
}

function render(state, data) {
  disposeShipyardViewer();
  const content = state.currentPage === 'overview'
    ? overviewPage(state, data)
    : state.currentPage === 'schedule'
      ? renderSchedulePage(state, data.project)
      : state.currentPage === 'quality'
        ? renderQualityPage(state, data.project, data.qualityInspectionRecords)
        : renderRiskPage(state, data.project, data.qualityInspectionRecords);
  app.innerHTML = renderAppFrame(renderNavigation(state), content, state);
  bindNavigation(app, store);
  if (state.currentPage === 'overview') {
    bindShipyardViewer(app, store, data.project, data.qualityInspectionRecords);
    bindFacilityPanel(app, store);
    bindAlertsPanel(app, store);
  } else if (state.currentPage === 'schedule') {
    bindSchedulePage(app, store, data.project);
  } else if (state.currentPage === 'quality') {
    bindQualityPage(app, store, data.project, data.qualityInspectionRecords);
  } else if(state.currentPage === 'risk') {
    bindRiskPage(app,store,data.project,data.qualityInspectionRecords);
  }
}

async function bootstrap() {
  try {
    const data = await loadProjectData();
    store.subscribe((state) => render(state, data));
    render(store.getState(), data);
    await splash.complete();
  } catch (error) {
    splash.fail();
    errorView(error);
  }
}

bootstrap();
