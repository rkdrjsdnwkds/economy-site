@echo off
cd /d "%~dp0"
echo Economy site local server
echo.
echo Open this address in Chrome:
echo http://127.0.0.1:5000/
echo.
node tools\dev-server.mjs
pause
