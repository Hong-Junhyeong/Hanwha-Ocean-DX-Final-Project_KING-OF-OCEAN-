# Shipyard Production Management Clean V11

완료된 V10을 기준으로 전체화면 재생 조작부, 최소 5초 로딩 및 단일 진행 막대, 작은 보조 글꼴만 수정했습니다. 계산 엔진·Excel·3D 모델·메뉴·페이지 구조는 보존했습니다. 배포하거나 Phase 12를 진행하지 않았습니다.

## Windows 실행

Node.js 22.12 이상을 설치한 뒤 ZIP 전체를 압축 해제하고 `package.json` 옆의 **start-dev.bat**을 더블클릭합니다. 누락된 패키지를 설치하고 Vite와 기본 브라우저를 엽니다. 공백이 있는 폴더 경로도 처리합니다. 서버 창을 닫거나 Ctrl+C로 종료합니다.

첫 패키지 설치에는 인터넷 연결이 필요합니다. Linux 환경에서 배치 구문과 CRLF를 확인했으며 실제 Windows 실행은 미검증입니다.

```sh
npm install
npm run dev
npm run build
npm run preview
```

## 변경 사항

- 전체화면에서는 기존 재생·정지·다시 시작·탐색·배속 조작부가 첫 화면에 보입니다. 측면 패널과 상세 설명은 필요한 경우 자체 스크롤을 사용합니다. Native Fullscreen API와 CSS 대체 모드에 같은 화면 규칙을 적용합니다.
- 승인 PNG 원본은 그대로 사용합니다. 첫 진입 화면은 최소 5초이며 데이터 초기화는 즉시 병행합니다. 이미지의 원래 막대 위치를 가린 하나의 HTML 막대가 움직입니다. 이 표시는 경과 시간에 따른 연출이며 다운로드 백분율이 아닙니다. 실제 준비가 늦으면 완료 직전에서 기다리고, 실패하면 오류·재시도를 표시합니다.
- 3D 및 일부 페이지 보조 글꼴만 1–2px 조정했습니다. 제목·큰 수치·로고·기존 글꼴 계열은 유지합니다.

전체 편집 소스, 원천 자료, 기존 3D, Excel 생성기, 테스트와 실제 화면 증거가 포함되어 있습니다. `dist/`는 V11 생산 빌드이며 `node_modules`는 제외했습니다. `assembly_factory_v9.html`과 `ASSEMBLY_PLAYBACK_PLAN_V1` 명칭은 기존 연결 호환성을 위해 유지했습니다.

## 검사 명령

```sh
npm test
npm run test:playback
npm run test:preservation
npm run test:browser
npm run test:browser:regression
npm run test:browser:scenarios
npm run test:workbooks
npm run build
npm run test:browser:build
```

브라우저 검사는 Playwright Chromium이 필요합니다. 설치되지 않은 환경은 `npx playwright install chromium`을 먼저 실행합니다. 별도 실행 파일은 `CHROMIUM_EXECUTABLE` 환경 변수로 지정할 수 있습니다. Excel 검사는 브라우저 회귀 검사가 생성한 파일과 입력 스냅샷을 사용합니다. 이번 실행 결과도 포함했습니다.

구현: `IMPLEMENTATION_SUMMARY_KO.md`  
실제 결과·제한: `TESTING_REPORT_KO.md`  
이번 화면·검사 기록: `docs/phase11/`

V10 루트 문서는 `docs/v10-archive/`에 보관했습니다. 과거 단계의 문서와 테스트 기록은 해당 버전의 결과입니다. 브라우저 자체 확대율, 실제 모바일 기기/Safari, 실제 Windows·Excel 데스크톱 실행의 검증 여부는 보고서를 확인해 주세요.
