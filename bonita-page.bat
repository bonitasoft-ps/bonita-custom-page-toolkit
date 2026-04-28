@echo off
rem bonita-page — standalone CLI wrapper for Windows. No `npm install -g`,
rem no IA needed. Just clone the repo and run this script.

setlocal enableextensions

set "SCRIPT_DIR=%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is required but not installed.
  echo Install Node.js 20+ from https://nodejs.org/ and try again.
  exit /b 1
)

node "%SCRIPT_DIR%scripts\cli.js" %*
exit /b %errorlevel%
