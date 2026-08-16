# _night_run.ps1 -- unattended overnight verification (owner request 2026-08-11).
# Holds a process-scoped keep-awake (ES_SYSTEM_REQUIRED -- auto-releases when
# this process exits; no power settings are changed), then runs the full gate
# and the night giants back-to-back. Drops _night_run_DONE.txt with both
# verdicts so the morning check is one file.
#   pwsh -NoProfile -File tools/_night_run.ps1
Add-Type -Namespace KeepAwake -Name Native -MemberDefinition @'
[DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
public static extern uint SetThreadExecutionState(uint esFlags);
'@
# ES_CONTINUOUS (0x80000000) | ES_SYSTEM_REQUIRED (0x00000001)
[KeepAwake.Native]::SetThreadExecutionState(0x80000001) | Out-Null

Set-Location (Join-Path $PSScriptRoot '..')
$t0 = Get-Date
node tools/_gate.mjs full *> _night_full_log.txt
$fullExit = $LASTEXITCODE
node tools/_gate.mjs night --no-build *> _night_giants_log.txt
$nightExit = $LASTEXITCODE

$done = @(
  "finished $(Get-Date) (started $t0)"
  "full  exit $fullExit  -- $((Select-String -Path _night_full_log.txt -Pattern 'GATE' | Select-Object -Last 1).Line)"
  "night exit $nightExit -- $((Select-String -Path _night_giants_log.txt -Pattern 'GATE' | Select-Object -Last 1).Line)"
)
$done | Out-File _night_run_DONE.txt
[KeepAwake.Native]::SetThreadExecutionState(0x80000000) | Out-Null
