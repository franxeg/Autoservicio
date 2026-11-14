@echo off
title Autoservicio - restaurar backup
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\restaurar.ps1" %*
pause
