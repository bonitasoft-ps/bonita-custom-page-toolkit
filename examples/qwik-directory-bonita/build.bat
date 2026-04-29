@echo off
rem build.bat — install + build + docs helper for the Bonita custom page (Qwik)
rem
rem Usage:
rem   build.bat            npm install + ZIP + docs (everything)
rem   build.bat install    only npm install
rem   build.bat build      only the ZIP (no install, no docs)
rem   build.bat dist       only the ZIP + docs (no install)

setlocal enableextensions
cd /d "%~dp0"

set "CMD=%~1"
if "%CMD%"=="" goto all
if /I "%CMD%"=="install" goto install
if /I "%CMD%"=="build" goto build
if /I "%CMD%"=="dist" goto dist
if /I "%CMD%"=="-h" goto usage
if /I "%CMD%"=="--help" goto usage
if /I "%CMD%"=="help" goto usage

echo Unknown command: %CMD%
goto usage

:all
call :do_install
if errorlevel 1 exit /b %errorlevel%
call :do_dist
if errorlevel 1 exit /b %errorlevel%
call :print_outputs
exit /b 0

:install
call :do_install
exit /b %errorlevel%

:build
call :do_build
if errorlevel 1 exit /b %errorlevel%
call :print_outputs
exit /b 0

:dist
call :do_dist
if errorlevel 1 exit /b %errorlevel%
call :print_outputs
exit /b 0

:do_install
echo ==^> npm install
call npm install
exit /b %errorlevel%

:do_build
echo ==^> npm run build:bonita
call npm run build:bonita
exit /b %errorlevel%

:do_dist
echo ==^> npm run dist (ZIP + docs)
call npm run dist
exit /b %errorlevel%

:print_outputs
echo.
echo Output:
if exist "dist\page-appDirectoryBonitaQwikHome.zip" echo   %CD%\dist\page-appDirectoryBonitaQwikHome.zip   ^(upload this ZIP to Bonita resource-list^)
if exist "dist\DEPLOY-README.md"               echo   %CD%\dist\DEPLOY-README.md
if exist "dist\DEPLOY-README.html"             echo   %CD%\dist\DEPLOY-README.html
exit /b 0

:usage
echo Usage: %~nx0 [install^|build^|dist]
echo   no arg   install + ZIP + docs
echo   install  only npm install
echo   build    only the ZIP
echo   dist     ZIP + docs ^(no install^)
exit /b 1
