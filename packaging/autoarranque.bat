@echo off
title Autoservicio - autoarranque
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\autoarranque.ps1" %*
pause
