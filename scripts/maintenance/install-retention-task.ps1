param(
    [string]$TaskName = "OrderRetentionCleanupDaily",
    [string]$ProjectDir = "E:\Project\Order-Project-Backend",
    [string]$Time = "03:00",
    [string]$NpmScript = "maintenance:cleanup-orders:dev",
    [string]$DatabaseHost = "",
    [string]$DatabasePort = "",
    [string]$DatabaseSsl = ""
)

$runnerPath = Join-Path $ProjectDir "scripts\maintenance\run-retention-task.ps1"
$taskCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$runnerPath`""

schtasks /Create `
  /TN $TaskName `
  /SC DAILY `
  /ST $Time `
  /TR $taskCommand `
  /RU SYSTEM `
  /RL HIGHEST `
  /F 2>$null | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Warning "Could not register task as SYSTEM. Falling back to current user."
    schtasks /Create `
      /TN $TaskName `
      /SC DAILY `
      /ST $Time `
      /TR $taskCommand `
      /F
}

Write-Output "Installed task '$TaskName' at $Time using script '$NpmScript'"
