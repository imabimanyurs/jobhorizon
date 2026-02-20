# setup_scheduler.ps1
# Sets up Windows Task Scheduler to run the daily scraper at 6:00 AM IST
# Usage: Run as Administrator
#   .\setup_scheduler.ps1

$TaskName = "JobHorizon_DailyScrape"
$ScriptPath = Join-Path $PSScriptRoot "scraper\daily_run.py"
$PythonPath = "python"  # Uses system Python; change to full path if needed
$WorkingDir = Join-Path $PSScriptRoot "scraper"
$LogFile = Join-Path $PSScriptRoot "data\daily_run.log"

# Create the action
$Action = New-ScheduledTaskAction `
    -Execute $PythonPath `
    -Argument "`"$ScriptPath`" --all >> `"$LogFile`" 2>&1" `
    -WorkingDirectory $WorkingDir

# Trigger: Daily at 6:00 AM
$Trigger = New-ScheduledTaskTrigger -Daily -At "06:00AM"

# Settings: run even if not logged in, don't stop if on battery
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

# Register the task
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Daily job scraping: runs all APIs (Greenhouse, Lever, SerpAPI, Adzuna, JSearch), cleans up jobs >30 days old." `
    -Force

Write-Host ""
Write-Host "Task '$TaskName' created successfully!" -ForegroundColor Green
Write-Host "  Schedule:    Daily at 6:00 AM" -ForegroundColor Cyan
Write-Host "  Script:      $ScriptPath" -ForegroundColor Cyan
Write-Host "  Log file:    $LogFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "To verify:  Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "To remove:  Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
Write-Host "To run now: Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ""
