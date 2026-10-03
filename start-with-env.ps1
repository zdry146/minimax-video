# Launches the minimax-video Express server with MINIMAX_KEY inherited
# from the User-level environment, so the Node child process can see it
# (Node started directly does not pick up User env by default).
[CmdletBinding()]
param([switch]$Background = $true)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$key = [Environment]::GetEnvironmentVariable('MINIMAX_KEY', 'User')
if (-not $key) {
    Write-Error 'MINIMAX_KEY is not set at User scope. Set it via SystemPropertiesAdvanced.'
}
Write-Host ("key length: {0}" -f $key.Length)

# Build a fresh environment block that includes MINIMAX_KEY plus the
# current process's variables.
$envBlock = [System.Collections.Generic.Dictionary[string, string]]::new()
foreach ($kvp in [Environment]::GetEnvironmentVariables('Process').GetEnumerator()) {
    $envBlock[$kvp.Key] = [string]$kvp.Value
}
$envBlock['MINIMAX_KEY'] = $key

if ($Background) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = (Get-Command node.exe).Source
    $psi.Arguments = 'dist\server.js'
    $psi.WorkingDirectory = $PSScriptRoot
    $psi.UseShellExecute = $false
    foreach ($kvp in $envBlock.GetEnumerator()) {
        $psi.Environment[$kvp.Key] = $kvp.Value
    }
    $psi.EnvironmentVariables.Remove('minimax-key') | Out-Null  # normalize
    $proc = [System.Diagnostics.Process]::Start($psi)
    Write-Host ("started pid {0}" -f $proc.Id)
} else {
    $env:MINIMAX_KEY = $key
    node dist\server.js
}