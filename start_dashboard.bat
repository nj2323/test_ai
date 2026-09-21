@echo off
chcp 65001 > nul
echo ========================================================
echo   DataStats Pro - 원클릭 데이터 통계 분석 대시보드
echo ========================================================
echo.
echo [1] 로컬 웹 서버 시작 (http://localhost:8080)
echo [2] 기본 브라우저로 즉시 열기 (file://)
echo.

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Python 환경이 감지되었습니다. 로컬 HTTP 서버를 실행합니다...
    echo 브라우저가 자동으로 열립니다. 서버를 종료하려면 이 창을 닫으세요.
    start "" http://localhost:8080
    python -m http.server 8080
) else (
    echo Python이 감지되지 않아 기본 브라우저로 직접 엽니다...
    start "" "%~dp0index.html"
)
