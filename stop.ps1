# Stops the minimax-video Express server by killing whatever process
# is currently listening on the project's port (default 3000).
# Pairs with start-with-env.ps1.
[CmdletBinding()]
param(
    [int]$Port = 3000
)

$ErrorActionPreference = 'SilentlyContinue'

$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $conn) {
    Write-Host "No process is listening on port $Port. Nothing to stop."
    exit 0
}

$killed = @()
foreach ($c in $conn) {
    $pid_ = $c.OwningProcess
    $proc = Get-Process -Id $pid_ -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host ("Stopping pid {0} ({1}) on port {2}..." -f $pid_, $proc.ProcessName, $Port)
        Stop-Process -Id $pid_ -Force
        $killed += $pid_
    }
}

# Verify
Start-Sleep -Milliseconds 300
$remaining = Get-NetTCPConnection -LocalPort $Port -State Listen
if ($remaining) {
    Write-Warning ("Some processes are still listening on port {0}: {1}" -f $Port, (($remaining.OwningProcess) -join ', '))
    exit 1
}

Write-Host ("Stopped. Killed pids: {0}" -f ($killed -join ', '))
exit 0
