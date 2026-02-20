@echo off
REM JobRadar Daily Scraper
REM Schedule this with Windows Task Scheduler to run at 6 AM daily

cd /d "%~dp0scraper"
python scraper.py >> "%~dp0data\scraper.log" 2>&1
echo [%date% %time%] Scraper completed >> "%~dp0data\scraper.log"
