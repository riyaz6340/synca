@echo off
echo Installing Avento Mobile dependencies...
cd /d "%~dp0.."
npm install
echo.
echo Setup complete! Run 'npx expo start' to start development.
pause
