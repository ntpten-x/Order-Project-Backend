param(
    [string]$TaskName = "OrderRetentionCleanupDaily",
    [string]$ProjectDir = "E:\Project\Order-Project-Backend",
    [string]$Time = "03:00"
)

$command = "cd /d `"$ProjectDir`" && set ORDER_RETENTION_ENABLED=true && set ORDER_QUEUE_RETENTION_ENABLED=true && npm run maintenance:cleanup-orders"

schtasks /Create `
  /TN $TaskName `
  /SC DAILY `
  /ST $Time `
  /TR "cmd.exe /c $command" `
  /F

Write-Output "Installed task '$TaskName' at $Time"
