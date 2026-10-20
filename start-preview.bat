@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo [ERROR] Node.js가 필요합니다.
 pause
 exit /b 1
)
if not exist "dist\index.html" (
 echo [ERROR] dist 빌드 파일이 없습니다. start-dev.bat를 실행하십시오.
 pause
 exit /b 1
)
start "" "http://127.0.0.1:4173/"
node scripts/preview.mjs
if errorlevel 1 pause
endlocal
