# Run elevated: route only the new Klimat Pro gateway outside the VPN.
$ErrorActionPreference = 'Stop'
Start-Transcript -Path (Join-Path $env:TEMP 'klimat-vps-route.log') -Append | Out-Null
$taskIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$taskPrincipal = [Security.Principal.WindowsPrincipal]::new($taskIdentity)
if (-not $taskPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Administrator rights required to restore the direct VPS route.'
}
$taskPrefix = '83.217.214.234/32'
$taskAdapters = @(Get-NetAdapter -Physical | Where-Object Status -eq 'Up')
$taskDefaults = @(Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' |
    Where-Object { $_.InterfaceIndex -in $taskAdapters.InterfaceIndex -and $_.NextHop -ne '0.0.0.0' } |
    Sort-Object RouteMetric, InterfaceMetric)
if ($taskDefaults.Count -eq 0) { throw 'Physical IPv4 default gateway unavailable.' }
$taskDefault = $taskDefaults[0]
$taskExisting = @(Get-NetRoute -AddressFamily IPv4 -DestinationPrefix $taskPrefix -ErrorAction SilentlyContinue)
if ($taskExisting.Count -gt 0) {
    if (@($taskExisting | Where-Object { $_.InterfaceIndex -ne $taskDefault.InterfaceIndex -or $_.NextHop -ne $taskDefault.NextHop }).Count -gt 0) {
        throw 'An existing VPS route conflicts with the requested direct route.'
    }
} else {
    New-NetRoute -DestinationPrefix $taskPrefix -InterfaceIndex $taskDefault.InterfaceIndex -NextHop $taskDefault.NextHop -RouteMetric 1 | Out-Null
}
Get-NetRoute -DestinationPrefix $taskPrefix -ErrorAction Stop | Format-Table DestinationPrefix, InterfaceAlias, NextHop, PolicyStore
Stop-Transcript | Out-Null
