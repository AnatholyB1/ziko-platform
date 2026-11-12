# Stops the UAT emulator by PID listening on console port 5554 (never by image name).
$c = Get-NetTCPConnection -LocalPort 5554 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $c) { Write-Host 'no emulator on 5554'; exit 0 }
try { & adb -s emulator-5554 emu kill | Out-Null } catch {}
Start-Sleep -Seconds 5
$c = Get-NetTCPConnection -LocalPort 5554 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($c) { Stop-Process -Id $c.OwningProcess -Force; Write-Host "killed pid $($c.OwningProcess)" } else { Write-Host 'emulator stopped' }
