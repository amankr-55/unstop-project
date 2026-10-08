$targetZip = Join-Path $PSScriptRoot "..\bharat-gst-sentinel.skill"
$stageDir = Join-Path $PSScriptRoot "..\temp_pack\bharat-gst-sentinel"

if (Test-Path "temp_pack") { Remove-Item "temp_pack" -Recurse -Force }
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

Copy-Item -Path "SKILL.md", "LICENSE", "package.json" -Destination $stageDir -Force
Copy-Item -Path "scripts" -Destination $stageDir -Recurse -Force
Copy-Item -Path "references" -Destination $stageDir -Recurse -Force

# Remove pack.ps1 from the packaged output
if (Test-Path (Join-Path $stageDir "scripts\pack.ps1")) {
    Remove-Item (Join-Path $stageDir "scripts\pack.ps1") -Force
}

if (Test-Path $targetZip) { Remove-Item $targetZip -Force }

# Compress
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $PSScriptRoot "..\temp_pack"), $targetZip)

Remove-Item "temp_pack" -Recurse -Force

Write-Host "SUCCESS: Created $targetZip"
Get-Item $targetZip | Select-Object Name, Length
