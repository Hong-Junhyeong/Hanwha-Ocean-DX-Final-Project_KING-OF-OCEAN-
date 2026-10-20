# V9 구현 상태

이 문서는 V8 시점의 원본 매핑 분석을 보존합니다. 아래의 미구현·남은 작업 표기는 V8 기준입니다. V9에서는 로컬 연결·시각별 재생·효과 연결을 완료했습니다. 현재 구현과 제한은 IMPLEMENTATION_SUMMARY_KO.md 및 VIEWER_BRIDGE_KO.md를 참고하십시오. 이전 원문은 docs/v8-archive/에도 있습니다.

# Phase 9용 3D 데이터 연결 안내

이 문서는 연결 설계입니다. Phase 8에서 3D HTML·재생 엔진·카메라·크레인·부재 형상을 수정하거나 로컬 뷰어를 연결하지 않았습니다.

## 원본과 식별

원본: `integration-reference/assembly_factory_v1.original.html`

SHA-256: `e5b2d85432e189df94872bd2ca4313de0d9cf385445bcf061201097bae9b9155`

이번 실제 첨부는 assembly_factory_v1(3).html입니다. 지시문에 적힌 (2) 대신 실제 첨부 (3)을 그대로 보존했습니다. 코드 정적 확인으로 다음 식별자를 확인했습니다. 실제 현장 B-203 부재 데이터와 일치한다는 뜻은 아닙니다. 원본의 반출 이벤트는 B18U/S18G를 사용하므로 Phase 9에서도 B-203 실제 반출로 오해하면 안 됩니다.

| 공개 객체/이름 | 원본 기능 | Phase 9 연결 지점 |
| --- | --- | --- |
| window.assemblyApp.engine | step/u, applyState, setInstantState, tick/reset | 기존 압축 재생을 새 시간 상태 소비 방식으로 바꿀 대상 |
| window.assemblyApp.blocks | root/assembly/modules/foreGroups | 모듈 참조 |
| FORE_BLOCK_ROOT / FORE_ASSEMBLY_ROOT | 전체 기준 그룹 / 조립 그룹 | 부재·좌표 기준 |
| modules[].userData.moduleId / foreModuleId | S180 등 / LOWER_BOW 등 | 아래 교육용 매핑 키 |
| CRN-01 / TROLLEY / HOOK | 크레인·트롤리·후크 | FITUP 활성 구간에서 시각화 |
| window.assemblyApp.engine.effects | weld/inspection 데모 표현 | 용접·검사·가상 보수 표현을 분리할 대상 |
| window.assemblyApp.cam | camera controls / transitions | 생산 수치 계산 없이 카메라 소비 |
| W01~W05 | 용접선의 교육용 경계 표현 | 실제 결함 위치로 단정하지 않는 시각화 |

원본의 Nf는 모듈 정의, Bd는 legacy module→fore-module 키, Vd는 *_GRP 및 userData 생성입니다. 기하 조립 순서 Gr=[0,4,1,2,3]은 S180→T350→S190→D380→D390입니다. 원본은 minified 단일 HTML이므로 식별자 문자열·객체 속성을 기준으로 연결하십시오.

## 기하 진행과 생산 단계 분리

원본 Qt의 7단계는 기하 조립 5단계, 용접·검사 데모, 운반 데모입니다. 기존 progress=5/25/45/60… 같은 시연값 및 duration=22s…는 생산 데이터가 아닙니다.

새 생산 단계는 `namespace=PRODUCTION_PLAYBACK`, STEP_01~07입니다. 기하 단계는 별도 `GEOMETRY_STAGE` 개념과 numeric index를 유지하고 생산 STEP ID를 그대로 기하 배열 인덱스로 쓰지 마십시오. 모듈은 `GEOMETRY_MODULE`입니다.

| 생산 단계 | 생산 데이터 | 시각화 의도와 주의 |
| --- | --- | --- |
| FITUP | T10 구간·현재 MH 진도 | 정렬·인양·취부·가용접. 활성 WORK/OT에서만 크레인 동작 의도 ACTIVE |
| WELDING | T20 구간·자원 | 용접선·아크, 크레인 HOME. 기하 모듈 개수로 공수 계산 금지 |
| FINISH | T30 구간 | 마감·검사 준비. 이미 원작업인 공수를 추가하지 않음 |
| INITIAL_QC | QC 레인과 생산 대응5 MH | 검사 연속시간과 생산 대응은 동시 별도 자원. 5 MH를 두 번 가산하지 않음 |
| REWORK | 현재 품질 모델의 추가 MH | VIRTUAL_REWORK, 교육용 연마·국부 용접. 확정 균열·기공 좌표를 만들지 않음 |
| REINSPECTION | WAIT_QC/비근무/실제 검사 분리 | 대기 중 검사 진도·아크 정지. QC_REINSPECTION에서만 검사 진행 |
| HANDOVER | 계산된 release 마일스톤 | 품질 인계 상태. 실제 운반시간·반출 완료나 후행 완료를 뜻하지 않음 |

## 64.71% 교육용 모듈 매핑

기본 모드는 MH_BASED_SCHEMATIC, 근거는 EDUCATIONAL_ASSUMPTION입니다. 실제 부재별 공수·완료 데이터는 없습니다. 아래 가중치는 명시적 교육용 가정입니다.

| 모듈 ID | 실제 객체 이름 | 가중 MH | 누적 MH | 스냅샷 상태 |
| --- | --- | ---: | --- | --- |
| S180 | LOWER_BOW_GRP | 100 | 0~100 | COMPLETE |
| T350 | COLLISION_BHD_GRP | 60 | 100~160 | COMPLETE |
| S190 | PORT_SHELL_GRP | 80 | 160~240 | PARTIAL 75% |
| D380 | STBD_SHELL_GRP | 60 | 240~300 | NOT_STARTED |
| D390 | UPPER_BOW_GRP | 40 | 300~340 | NOT_STARTED |

BULB_GRP는 LOWER_BOW_GRP의 자식이며 별도 공수로 다시 더하지 않습니다. 합계340 MH 중220 MH가 완료된 교육용 표시입니다. T10/T20/T30/T40의 잔여120 MH와 합쳐서460 MH로 만들면 안 됩니다. 추가 보수로 모듈의 원작업 진도가100%를 넘지 않습니다.

진행 중 각 모듈은 getPlaybackStateAt의 geometryProgress로 갱신합니다. 사용자 계획량이 달라지면 교육 가중치를 비례 조정하며 실제 구조 변경을 뜻하지 않습니다.

## 데이터 소비 순서

1. 현재 세션의 playbackPlan 또는 기존 결과 JSON의 playbackPlan을 가져옵니다.
2. validateAssemblyPlaybackPlan 결과와 playbackReady를 확인합니다. false이면 readinessIssues를 표시하고 임의 시간으로 대체하지 않습니다.
3. Phase 9 플레이어가 화면 재생시간→실제 생산시각을 매핑합니다. 압축 비율은 시각화 계층에서만 관리합니다.
4. getPlaybackStateAt(plan, ISO 시각)으로 단계·진도·원작업 진도·품질/인계 상태·레인을 가져옵니다.
5. WORK/OT에서 관련 애니메이션을 진행하고 LUNCH/WAIT_NONWORK/WAIT_QC/EQUIPMENT_STOP은 해당 영향 작업을 멈춥니다. 비영향 레인은 동시에 진행할 수 있습니다.
6. 선택 변경 시 이전 계획을 폐기하고 새 입력 지문의 계획으로 교체합니다. 3D에서 MH·납기·QC 창·노무비를 다시 계산하지 않습니다.

시각 정밀도·상태 enum·가변 인원·대기·유급 배정의 의미는 PLAYBACK_CONTRACT_KO.md를 따릅니다. 초 단위의 기존 엔진 라벨과 별도로 실제 적분 epoch-hour 경계를 제공했습니다.

## 남은 연결 작업

실제 메시지 브리지·iframe 교체·압축 재생·상태별 effects 변경·초기 모듈 부분 표현·카메라 연결은 구현하지 않았습니다. 원본의 기존 재생 엔진을 그대로 호출하면 기하 데모의 0%·시연 시간·반출 이벤트가 적용될 수 있으므로 Phase 9에서 데이터 소비 어댑터가 필요합니다. 현장 부재·결함·자격·설비 능력의 실증 매핑도 별도 검증 대상입니다.
