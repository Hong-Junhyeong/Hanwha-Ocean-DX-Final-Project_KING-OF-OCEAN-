import { icon } from './icons.js';

const pages = {
  quality: {
    eyebrow: 'PHASE 3 FOUNDATION',
    title: '품질 관리 현황',
    description: '검사 데이터 연결 기반만 준비되었습니다. 품질 분석과 차트는 Phase 3에서 구현합니다.',
    items: ['12개월·6개월 분석', '월별 품질 추이', '산점도', '검사 필터', '보수 통계', '상세 이력'],
  },
  risk: {
    eyebrow: 'PHASE 4 FOUNDATION',
    title: '위험 시뮬레이션 및 대응안',
    description: '시나리오 데이터 계약만 유지합니다. 계산 엔진과 비용 최적화는 Phase 4에서 구현합니다.',
    items: ['R3 설비 중단', 'R4 품질 보수', '필요 버퍼', '대응안 비교', '노무비 시뮬레이션', '예산·인계 비교'],
  },
};

export function renderFuturePage(pageId) {
  const page = pages[pageId] || pages.quality;
  return `
    <section class="future-page">
      <div class="future-page__intro">
        <span class="eyebrow">${page.eyebrow}</span>
        <h2>${page.title}</h2>
        <p>${page.description}</p>
      </div>
      <div class="future-grid">${page.items.map((item, index) => `<article><span>${String(index + 1).padStart(2,'0')}</span>${icon(index % 2 ? 'chart' : 'database')}<h3>${item}</h3><p>후속 단계 구현 예정</p></article>`).join('')}</div>
      <div class="future-boundary">${icon('info')} 후속 단계 범위 통제를 위해 고급 분석·시뮬레이션 기능은 활성화하지 않았습니다.</div>
    </section>
  `;
}
