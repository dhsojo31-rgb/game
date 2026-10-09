@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 책표지 탐정단 서버를 시작합니다. 브라우저가 자동으로 열립니다.
start "" http://localhost:8080
node serve.cjs 8080
pause
