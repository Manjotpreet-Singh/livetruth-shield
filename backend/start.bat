@echo off
TITLE LiveTruth Shield Backend
echo ===================================================
echo     LiveTruth Shield - AI Real-Time Fact Checker
echo ===================================================
echo.
echo [*] Starting LiveTruth Shield Server on http://localhost:5000 ...
python main.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Server exited with an error.
)
pause
