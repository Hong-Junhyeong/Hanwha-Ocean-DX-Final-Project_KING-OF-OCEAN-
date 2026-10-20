# V9 로컬 뷰어 연결

## 단일 계산 경로

`riskPage.readAppliedPlayback(project, records)` → 기존 session.playbackPlan → `connectProductionViewer` → 로컬 HTML입니다. getter는 복사본만 반환합니다. 초안·적용 입력을 덮어쓰거나 새 시뮬레이션 세션을 병행하지 않습니다. 위험 페이지 미방문 시에만 기존 baseline 초기화 경로를 재사용합니다.

부모가 ASSEMBLY_PLAYBACK_PLAN_V1을 기존 검증기로 확인합니다. iframe에는 품질 예측·노무비·MH 일정·QC 창 계산식이 없습니다. 예제 JSON은 회귀 테스트용으로만 남아 있습니다.

## 메시지 순서

프로토콜은 B203_PRODUCTION_VIEWER_V1입니다. HELLO → PLAN → PLAN_ACK 후 STATE_REQUEST → STATE입니다. STATUS는 STALE/INVALID/UNAVAILABLE, VIEWER_ERROR는 초기화 실패입니다. 부모 수신 계약은 src/viewer/VIEWER_MESSAGE_V1.schema.json이며 Ajv로 검증합니다.

- 부모는 location.origin과 실제 iframe.contentWindow를 모두 검사합니다.
- 자식은 location.origin과 window.parent, viewerId·channel·planId·inputVersion을 검사합니다.
- 채널은 뷰어 연결마다 새 UUID입니다. 이전 iframe·이전 계획·이전 버전 메시지는 적용하지 않습니다.
- 요청번호는 단조 증가하며 이미 처리한 번호는 거부합니다. 탐색 중 먼저 보낸 응답은 최신 탐색을 덮어쓰지 않습니다.
- 전체 계획은 변경 시에만 전송하고 상태 조회를 한 건씩 처리합니다. 한 원본 RAF 루프를 유지합니다.
- 부모 DOM 교체 전 타이머·수신 리스너를 해제합니다. 프레임 종료 시 자식 재생을 정지합니다.

## 시각과 표시

자식은 시나리오 시작부터 엔진의 인계 epoch 경계까지 표현 시간을 이동합니다. 기본 목표 압축 시간90초, 속도0.5/1/2/4배는 표시 설정입니다. 부하·응답에 따라 재생이 느려질 수 있으며 생산 날짜를 변경하지 않습니다.

부모는 getPlaybackStateAt(plan,timestamp)와 원본 segment의 활성 레인을 반환합니다. 자식은 받은 생산·품질·기하 진도를 기존 pose와 효과에 적용합니다. 반복 탐색은 같은 상태를 복원합니다. 단계 선택은 해당 생산 단계의 실제 시작시각으로 이동합니다. SKIPPED 단계는 새 작업을 만들지 않습니다.

원작업100%와 품질 인계 완료를 구분합니다. 최초 QC 생산 대응5 MH와 검사원1시간을 다시 합산하지 않습니다. V8의 초 단위 문자열/정밀 epoch 경계 의미도 바꾸지 않았습니다.

## 실패 표시

초안이 미반영되거나 검증에 실패하면 새 계획을 적용하지 않고 명확한 안내를 표시합니다. 이미 표시 중인 마지막 검증 상태는 정지합니다. HTML을 단독으로 열면 메인 Overview에서 연결하도록 안내하며 기존0% 시연으로 자동 복귀하지 않습니다. WebGL 초기화 실패도 부모에 표시합니다.

## 표현의 한계

모듈 pose·투명도는 교육용 MH 매핑입니다. 용접/검사 효과는 공정의 개념적 표현이고 실제 결함 좌표·검사 합격 증거가 아닙니다. HANDOVER는 모델 품질 인계로, 검증된 운반 일정이 없어 트랜스포터 출거를 실행하지 않습니다. 원본 HTML 보관 파일과 기하 생성 코드는 그대로입니다.
