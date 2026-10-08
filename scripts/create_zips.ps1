$base = "C:\Users\ak127\Downloads\unstop"
$tempUnstop = Join-Path $base "temp_build\unstop"

if (Test-Path "temp_build") { Remove-Item "temp_build" -Recurse -Force }
New-Item -ItemType Directory -Path $tempUnstop -Force | Out-Null

Copy-Item (Join-Path $base "SKILL.md") -Destination $tempUnstop -Force
Copy-Item (Join-Path $base "LICENSE") -Destination $tempUnstop -Force
Copy-Item (Join-Path $base "package.json") -Destination $tempUnstop -Force
Copy-Item (Join-Path $base "scripts") -Destination $tempUnstop -Recurse -Force
Copy-Item (Join-Path $base "references") -Destination $tempUnstop -Recurse -Force

if (Test-Path (Join-Path $tempUnstop "scripts\pack.ps1")) { Remove-Item (Join-Path $tempUnstop "scripts\pack.ps1") -Force }
if (Test-Path (Join-Path $tempUnstop "scripts\create_zips.ps1")) { Remove-Item (Join-Path $tempUnstop "scripts\create_zips.ps1") -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem

# 1. unstop.zip & unstop.skill
$unstopZip = Join-Path $base "unstop.zip"
$unstopSkill = Join-Path $base "unstop.skill"
if (Test-Path $unstopZip) { Remove-Item $unstopZip -Force }
if (Test-Path $unstopSkill) { Remove-Item $unstopSkill -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $base "temp_build"), $unstopZip)
Copy-Item $unstopZip $unstopSkill -Force

Remove-Item "temp_build" -Recurse -Force

Write-Host "Created unstop.zip and unstop.skill successfully!"
Get-Item $unstopZip, $unstopSkill | Select-Object Name, Length
