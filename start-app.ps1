$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'
$backendPort = 5001
$frontendPort = 3004

Write-Host "Checking for port conflicts..."
$portsToFree = @($backendPort, $frontendPort)
foreach ($port in $portsToFree) {
    $pids = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
        if ($pid -and $pid -ne 0) {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped process $pid using port $port"
        }
    }
}

Write-Host "Starting backend..."
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendDir'; npm start" -PassThru -WorkingDirectory $root

Start-Sleep -Seconds 2

Write-Host "Starting frontend..."
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendDir'; npm run dev -- --host 0.0.0.0 --port $frontendPort" -PassThru -WorkingDirectory $root

Write-Host ""
Write-Host "Backend: http://localhost:$backendPort"
Write-Host "Frontend: http://localhost:$frontendPort"
Write-Host "" 
Write-Host "Admin login:"
Write-Host "Email: tirurconnect@gmail.com"
Write-Host "Password: admin123456789"
