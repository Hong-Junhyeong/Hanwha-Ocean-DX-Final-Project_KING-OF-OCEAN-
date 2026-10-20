@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Shipyard Production Management - Development Server

echo ============================================================
echo  Shipyard Production Management Clean V11
echo ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js를 찾을 수 없습니다.
  echo Node.js 22.12 이상을 설치한 후 다시 실행해 주세요.
  echo https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm을 찾을 수 없습니다.
  echo Node.js를 다시 설치한 후 실행해 주세요.
  pause
  exit /b 1
)

set "NEED_INSTALL=0"
if not exist "node_modules\.bin\vite.cmd" set "NEED_INSTALL=1"
if not exist "node_modules\exceljs\package.json" set "NEED_INSTALL=1"
if not exist "node_modules\ajv\package.json" set "NEED_INSTALL=1"
if not exist "node_modules\jszip\package.json" set "NEED_INSTALL=1"
if not exist "node_modules\@fontsource-variable\noto-sans-kr\package.json" set "NEED_INSTALL=1"
if "%NEED_INSTALL%"=="1" (
  echo [INFO] npm 패키지를 처음 설치합니다. 잠시 기다려 주세요.
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm 패키지 설치에 실패했습니다.
    echo 네트워크 연결과 npm 설정을 확인해 주세요.
    pause
    exit /b 1
  )
)

echo [INFO] 개발 서버를 시작하고 기본 브라우저를 엽니다.
echo [INFO] 서버를 종료하려면 이 창에서 Ctrl+C를 누르세요.
echo.
call npm run dev -- --host 0.0.0.0 --open

if errorlevel 1 (
  echo.
  echo [ERROR] Vite 개발 서버가 비정상 종료되었습니다.
  pause
  exit /b 1
)

endlocal
