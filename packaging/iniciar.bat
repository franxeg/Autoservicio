@echo off
title Autoservicio
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar.ps1" %*
if errorlevel 1 (
  echo.
  echo Ocurrio un error. Revisa la carpeta logs\.
  pause
) else (
  timeout /t 5 /nobreak >nul
)
