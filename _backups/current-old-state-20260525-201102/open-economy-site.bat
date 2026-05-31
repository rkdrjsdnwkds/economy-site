@echo off
cd /d "%~dp0"
start "" cmd /c "timeout /t 2 >nul && start http://127.0.0.1:5000/"
echo Economy site local server
echo.
echo Keep this window open while using the site.
echo.
node tools\dev-server.mjs
pause
