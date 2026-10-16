@echo off
title Autoservicio - detener
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\detener.ps1"
pause
