# Stops the disposable UAT stack: kills ONLY processes listening on its ports (never by image name),
# stops the disposable Postgres, removes apps/web/.env.local and the scratch directory.
$ErrorActionPreference = 'Continue'
$root = if ($env:UAT_ROOT) { $env:UAT_ROOT } else { Join-Path $env:TEMP 'ziko-uat' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$ports = if ($env:UAT_PORTS) { $env:UAT_PORTS -split "," } else { 3141, 3142, 3143, 3144 }
foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; "killed pid $($_.OwningProcess) on $port" }
}
$pgctl = 'C:\Users\Anatholy\scoop\apps\postgresql\current\bin\pg_ctl.exe'
if (Test-Path "$root\pgdata\postmaster.pid") { & $pgctl -D "$root\pgdata" -m fast stop | Out-Null }
Remove-Item -Force -ErrorAction SilentlyContinue "$repo\apps\web\.env.local"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $root
"teardown done"
