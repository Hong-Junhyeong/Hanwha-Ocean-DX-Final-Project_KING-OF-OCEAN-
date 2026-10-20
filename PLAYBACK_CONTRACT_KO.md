> V8 계산·재생 데이터 계약은 V9에서도 동일합니다. 본문의 3D 미구현 표기는 Phase 8 기준이며 V9 통신·표시는 VIEWER_BRIDGE_KO.md를 참고하십시오.

# ASSEMBLY_PLAYBACK_PLAN_V1 데이터 계약

스키마: `src/playback/ASSEMBLY_PLAYBACK_PLAN_V1.schema.json` (JSON Schema Draft 7).

## 생성·조회

```js
import { simulate } from './src/engine/simulation.js';
import { buildAssemblyPlaybackPlan, getPlaybackStateAt,
  validateAssemblyPlaybackPlan } from './src/playback/index.js';

const result = simulate(currentScenario, qualityRecords);
const plan = buildAssemblyPlaybackPlan(currentScenario, result);
const validation = validateAssemblyPlaybackPlan(plan);
const state = getPlaybackStateAt(plan, '2026-10-14T15:30:00+09:00');
```

엔진이 선택한 구간을 `activityTrace`에 기록합니다. 다른 일정 계산기로 다시 배정하지 않습니다. 세션의 `playbackPlan`과 기존 결과 JSON 다운로드의 `playbackPlan`은 같은 적용 입력·선택 대응안을 사용합니다. 미완료 입력·이전 결과의 내보내기 차단은 유지됩니다.

`npm run generate:playback`은 원본 v2 입력으로 N/A1/A2/B1/NONE JSON을 다시 생성합니다. `npm run test:playback`은 계약·진도·구간·납기 회귀를 검증합니다.

## 구역과 식별자

`schema=ASSEMBLY_PLAYBACK_PLAN_V1`, `version=1`입니다. 입력 JSON의 version:4, 제품 V8, 원본 데이터 버전과 서로 다른 버전입니다. `inputSnapshotId`는 정렬된 전체 입력 JSON의 FNV-1a 64비트 지문입니다. 입력 일치 확인용이며 보안 서명은 아닙니다.

생산 단계는 `namespace=PRODUCTION_PLAYBACK`의 STEP_01~07입니다. 기하 모듈은 `GEOMETRY_MODULE`의 S180/T350/S190/D380/D390입니다. 기존 HTML의 기하 단계 numeric id=1~7, array index=0~6과 별개입니다.

| 생산 ID | 공정 | 원본/기대 공수 | 주 자원 |
| --- | --- | --- | --- |
| STEP_01 | FITUP | T10, 기준20 MH | 생산·지원 |
| STEP_02 | WELDING | T20, 기준80 MH | 생산·지원 |
| STEP_03 | FINISH | T30, 기준15 MH | 생산·지원 |
| STEP_04 | INITIAL_QC | T40 생산 대응5 MH, QC연속1h | 생산과 QC 별도 레인 |
| STEP_05 | REWORK | 선택 모델의 추가 공수 | 생산·지원 |
| STEP_06 | REINSPECTION | QC 대기 및 연속 재검사1h | QC |
| STEP_07 | HANDOVER | 0 MH, 가상 인계 마일스톤 | 실제 운반시간 없음 |

표의 공수는 기본5명 시나리오입니다. 변경 시나리오는 기존 V7의 정상 공수 재분배·실제 추적을 사용하며 다른 블록에 B-203 수치를 복사하지 않습니다. 임의 작업 ID가 필수 T10~T40에 매핑되지 않으면 준비 상태를 거짓으로 표시합니다.

## 시간과 자원

모든 생산 ISO 시각은 `+09:00`입니다. V7 기존 `start/end` 문자열은 초 미만을 잘랐으므로 1초 이내 직렬화 차이가 있습니다. `startEpochHours/endEpochHours`는 실제 적분 경계의 epoch 시간(시간 단위)이고 `durationMinutes`도 같은 경계에서 계산합니다. 세밀한 재생에는 이 값을 사용하십시오. 기본 시나리오의 엔진 시각 문자열을 바꾸지 않았습니다.

시각 조회는 시간대가 있는 ISO 문자열을 받습니다. 초 단위의 정확한 단계 경계 라벨은 해당 엔진 경계로 해석합니다. 밀리초가 포함된 요청은 실제 적분 시각으로 조회합니다. 스냅샷 전 조회는 과거 진도를 지어내지 않고 스냅샷 진도로 고정하며 beforeSnapshot=true입니다.

`workHours`는 생산 단계의 실제 생산시간 또는 검사 단계의 실제 검사시간입니다. `elapsedHours`는 대기 포함 달력시간입니다. `durationHours`는 QC가 실제 검사한 시간입니다. `waitQcHours`는 해당 QC 단계에서 검사를 기다린 전체 경과시간으로 야간·점심도 포함합니다. 구체 원인은 각 segment type으로 구분합니다.

WORK/OT는 실제 MH를 증가시킵니다. LUNCH/WAIT_NONWORK/WAIT_QC/EQUIPMENT_STOP은 생산 MH를 늘리지 않습니다. QC_INSPECTION은 QC 레인의 검사와 생산 레인의 T40 대응을 구분합니다. QC_REINSPECTION의 생산 MH는 0입니다.

PRODUCTION/QC/EQUIPMENT/SUPPORT는 다른 레인이라 동시에 존재할 수 있습니다. 같은 레인의 충돌은 검증 오류입니다. EQUIPMENT_STOP은 영향 인원에 대한 중단이며 다른 생산·지원 인원은 작업할 수 있습니다. 대기는 한 레인에서 주 원인과 secondaryReason으로 표시합니다.

상위 effectiveWorkers/productivity는 단계 전체에 일정할 때만 값이 있습니다. 변하면 null이고 구간별 실제 인원·생산성을 읽습니다. B1의 합동 자원은 기본6명이며 sourceProcessLostMH=24를 직접 임금과 구분합니다.

`paidMH`는 해당 활동의 모델 유급/참여 공수입니다. 대기 등 유급 참석을 모르면 null입니다. 실제 증빙된 급여가 아닙니다. 계약 OT·지원의 미사용 유급 배정까지 포함한 비용 기준은 엔진의 `paidAllocations`와 기존 비용행입니다. 활동 중 사용된 paidMH만 합해 예산을 다시 만들면 안 됩니다.

## 진도와 상태

원작업 진도=(스냅샷 완료220 + 이후 원작업 완료MH)/340입니다. 초기64.7059%, T10후70.5882%, T20후94.1176%, T30후98.5294%, T40후100%입니다. 추가 보수는 원작업 분모·분자를 늘리지 않습니다.

단계 상태는 NOT_STARTED / READY / IN_PROGRESS / WAITING_NONWORK / WAITING_QC / SKIPPED / COMPLETE / RELEASED만 사용합니다. 단계별 조회 결과의 `steps`는 모든 단계의 상태·진도를 담습니다. 검사는 활성 검사시간으로만 진행하고 대기는 검사 진도를 올리지 않습니다. NONE은 보수·재검사 단계를 건너뜁니다.

별도의 qualityStatus는 INITIAL_QC_PENDING / REWORK_PENDING / REWORK_IN_PROGRESS / WAITING_QC / REINSPECTION_IN_PROGRESS / AWAITING_RELEASE / RELEASED입니다. handoverStatus는 NOT_RELEASED / RELEASED입니다. 원작업100%가 품질 인계 완료를 뜻하지 않습니다. `activeResourceLanes`는 현재 표시되는 대기 레인도 포함하므로 segment type과 함께 읽습니다.

## 준비 상태와 한계

playbackReady는 7단계·시각·구간·MH·레인·Schema·입력 지문·결정적 조회를 검증한 기술적 준비 상태입니다. 실제 작업 승인·비용 승인·QC 예약·현장 인계를 뜻하지 않습니다. 납기 FAIL인 N/A1도 지연을 재생할 데이터가 완전하면 true입니다.

예상 보수는 SYNTHETIC_EXPECTED, 사용자 가정은 HYPOTHETICAL, 확정 목록은 USER_CONFIRMED_INPUT으로 구분합니다. 실제 현장 확정이라는 뜻은 아닙니다. VIRTUAL_INSPECTION/VIRTUAL_REWORK는 개념 구역이며 결함 위치·원인·크랙 좌표를 만들지 않습니다.

교육 모듈 가중치는 기본340 MH이고 사용자 시나리오의 계획 MH가 다르면 비례 조정합니다. 실제 부재별 공수나 실측 완료 상태가 아닙니다. 운반·후행 공정 완료, 3D 압축 재생, 메시징 브리지는 이 단계에서 구현하지 않았습니다.
