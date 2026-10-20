import inspectionRecords from './inspectionRecords.json';
import qualityInspectionRecords from './qualityInspectionRecords.json';

export const DETAIL_URL = 'https://assembly-b18u-v1.tjdwnsdl546.chatgpt.site/';

export const facilities = {
  A_ZONE: {
    id: 'A_ZONE',
    shortName: 'A구역',
    name: 'A구역 선행의장',
    process: '선행의장',
    role: '블록 탑재 전 배관·장비·의장품을 선행 설치하는 공정 구역입니다.',
    flow: '대조립 → 선행의장 → 도장·탑재',
    availability: '시설 설명만 제공됩니다. 생산·품질 수치는 연결되지 않았습니다.',
  },
  B_ZONE: {
    id: 'B_ZONE',
    shortName: 'B구역',
    name: 'B구역 대조립공장',
    process: '대조립',
    role: '조립된 부재와 판넬을 대형 블록으로 결합하고 용접·검사하는 공정 구역입니다.',
    flow: '소조립 → 대조립 → 선행의장·도장',
    availability: 'B-203에 한해 상세 기준 데이터가 제공됩니다.',
  },
  C_ZONE: {
    id: 'C_ZONE',
    shortName: 'C구역',
    name: 'C구역 도장공장',
    process: '도장',
    role: '블록 표면 전처리와 방식 도장을 수행하는 공정 구역입니다.',
    flow: '대조립·선행의장 → 도장 → 탑재 대기',
    availability: '시설 설명만 제공됩니다. 생산·품질 수치는 연결되지 않았습니다.',
  },
  D_ZONE: {
    id: 'D_ZONE',
    shortName: 'D구역',
    name: 'D구역 탑재·도크',
    process: '탑재',
    role: '완료된 블록을 도크로 이동해 선체 구조로 탑재하는 공정 구역입니다.',
    flow: '도장 완료 → 운반 → 도크 탑재',
    availability: '시설 설명만 제공됩니다. 생산·품질 수치는 연결되지 않았습니다.',
  },
  E_ZONE: {
    id: 'E_ZONE',
    shortName: 'E구역',
    name: 'E구역 자재·물류',
    process: '자재·물류',
    role: '강재와 제작 자재를 보관하고 공정별 투입을 지원하는 물류 구역입니다.',
    flow: '입고·보관 → 공정별 공급 → 사용량 관리',
    availability: '시설 설명만 제공됩니다. 생산·품질 수치는 연결되지 않았습니다.',
  },
};

export const facilityCards = [
  { id: 'STEEL', name: '강재가공공장', role: '강재 절단·가공 자재 준비', icon: 'factory' },
  { id: 'SMALL', name: '소조립공장', role: '소부재 조립·부품 제작', icon: 'blocks' },
  { id: 'B_ZONE', name: 'B구역 대조립공장', role: '대형 블록 조립 B-201~B-204', icon: 'assembly' },
  { id: 'PAINT', name: '도장공장', role: '블록 도장·표면처리', icon: 'factory' },
  { id: 'DOCK', name: '탑재/도크', role: '선박 탑재·도크 작업', icon: 'crane' },
];

export const assemblySteps = [
  { id: 'STEP_01', label: '하부 선수·벌브 베이스 세팅' },
  { id: 'STEP_02', label: '충돌격벽·내부 프레임 취부' },
  { id: 'STEP_03', label: '좌현 외판 조립' },
  { id: 'STEP_04', label: '우현 외판 조립' },
  { id: 'STEP_05', label: '상부 선수·갑판 클로징' },
  { id: 'STEP_06', label: '본용접·검사·보수·재검사' },
  { id: 'STEP_07', label: '크레인 이송·트랜스포터 출거' },
];

export async function loadProjectData() {
  const response = await fetch('./data/source/B203_Web_Implementation_Data_v2_20261016.json');
  if (!response.ok) throw new Error('프로젝트 데이터를 불러오지 못했습니다.');
  const project = await response.json();
  return { project, inspectionRecords, qualityInspectionRecords };
}

export function getInspectionRecordsForSelection(records, state) {
  if (state.selectedBlock !== 'B-203') return [];
  return records.slice(0, 50);
}

export function getIssues(project, state) {
  if (state.selectedBlock !== 'B-203') return [];
  const baseR4 = project.risk.scenarios.find((item) => item.id === 'R4_12M_BASE_V2');
  return [
    {
      id: 'B203_BUFFER_ZERO',
      category: 'SCHEDULE',
      label: '일정',
      state: 'REFERENCE',
      stateLabel: '참조 조건',
      content: '정규 일정 여유 0시간',
      facility: 'B-203',
      detail: '잔여 120MH와 정규 3일 생산능력 120MH가 동일한 프로젝트 기준 조건입니다.',
    },
    {
      id: baseR4.id,
      category: 'QUALITY',
      label: '품질',
      state: 'EXPECTED',
      stateLabel: '예상 위험',
      content: `R4 예상 보수 ${baseR4.reworkMH.toFixed(2)}MH · 필요 대응 ${baseR4.requiredBufferHours.toFixed(2)}h`,
      facility: 'B-203',
      detail: '12개월 합성 최초검사 이력의 유형별 보수율을 남은 검사 50개에 적용한 기대값입니다. 확정 불량이 아닙니다.',
    },
    {
      id: project.risk.r3.id,
      category: 'EQUIPMENT',
      label: '설비',
      state: 'HYPOTHETICAL',
      stateLabel: '가정 시나리오',
      content: `R3 설비 중단 ${project.risk.r3.duration_hours}시간 · 생산기회 ${project.risk.r3.lostOpportunityMH}MH`,
      facility: 'B-203',
      detail: '대체작업이 없고 임계공정에 영향을 준다는 가정입니다. 잔여 정상 작업량 120MH에 더하지 않습니다.',
    },
  ];
}
