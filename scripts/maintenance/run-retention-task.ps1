param(
    [string]$ProjectDir = "E:\Project\Order-Project-Backend",
    [string]$NpmScript = "maintenance:cleanup-orders:dev",
    [string]$DatabaseHost = "localhost",
    [string]$DatabasePort = "5433",
    [string]$DatabaseSsl = "false"
)

$env:ORDER_RETENTION_ENABLED = "true"
$env:ORDER_QUEUE_RETENTION_ENABLED = "true"
$env:STOCK_ORDER_RETENTION_ENABLED = "true"
$env:AUDIT_LOG_RETENTION_ENABLED = "true"

if ($DatabaseHost -ne "") {
    $env:DATABASE_HOST = $DatabaseHost
}
if ($DatabasePort -ne "") {
    $env:DATABASE_PORT = $DatabasePort
}
if ($DatabaseSsl -ne "") {
    $env:DATABASE_SSL = $DatabaseSsl
}

Set-Location -Path $ProjectDir
$npmCmd = "C:\nvm4w\nodejs\npm.cmd"
if (-not (Test-Path $npmCmd)) {
    $npmCmd = "npm.cmd"
}
& $npmCmd run $NpmScript
exit $LASTEXITCODE
