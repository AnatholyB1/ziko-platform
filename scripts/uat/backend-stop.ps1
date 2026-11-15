# Arrete le backend UAT et les faux par PID de port d'ecoute (8200, 8210, 8211). Jamais taskkill /IM.
foreach ($port in 8200, 8210, 8211) {
  $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
  if (-not $pids) { Write-Host "port ${port}: rien"; continue }
  foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Write-Host "port ${port}: pid $p arrete" }
}
