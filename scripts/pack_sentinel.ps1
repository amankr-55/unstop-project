$base = "C:\Users\ak127\Downloads\unstop"
$stage = Join-Path $base "temp_sentinel\bharat-gst-sentinel"

if (Test-Path "temp_sentinel") { Remove-Item "temp_sentinel" -Recurse -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null

Copy-Item (Join-Path $base "SKILL.md") -Destination $stage -Force
Copy-Item (Join-Path $base "LICENSE") -Destination $stage -Force
Copy-Item (Join-Path $base "package.json") -Destination $stage -Force
Copy-Item (Join-Path $base "scripts") -Destination $stage -Recurse -Force
Copy-Item (Join-Path $base "references") -Destination $stage -Recurse -Force
Copy-Item (Join-Path $base "examples") -Destination $stage -Recurse -Force

# Clean any internal scripts
Get-ChildItem -Path (Join-Path $stage "scripts") -Filter "*.ps1" | Remove-Item -Force
Get-ChildItem -Path (Join-Path $stage "scripts") -Filter "test_*.js" | Remove-Item -Force

Add-Type -AssemblyName System.IO.Compression.FileSystem

$outZip = Join-Path $base "bharat-gst-sentinel.zip"
if (Test-Path $outZip) { Remove-Item $outZip -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $base "temp_sentinel"), $outZip)

Remove-Item "temp_sentinel" -Recurse -Force

# Copy to Desktop and Downloads
Copy-Item $outZip -Destination "C:\Users\ak127\Downloads\bharat-gst-sentinel.zip" -Force
Copy-Item $outZip -Destination "C:\Users\ak127\OneDrive\Desktop\bharat-gst-sentinel.zip" -Force

Write-Host "Created bharat-gst-sentinel.zip successfully!"
Get-Item $outZip | Select-Object Name, Length
