param(
    [Parameter(Mandatory = $true)][string]$BuildTools,
    [Parameter(Mandatory = $true)][string]$Platform,
    [Parameter(Mandatory = $true)][string]$Jdk
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
$out = Join-Path $env:TEMP "apkbuild"

if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Force -Path $out, "$out\classes", "$out\dex" | Out-Null

$androidJar = Join-Path $Platform "android.jar"
if (-not (Test-Path $androidJar)) { throw "找不到 $androidJar" }

Write-Host "1/6 aapt2 compile"
& "$BuildTools\aapt2.exe" compile --dir "$here\res" -o "$out\res.zip"

Write-Host "2/6 aapt2 link"
& "$BuildTools\aapt2.exe" link -o "$out\base.apk" --manifest "$here\AndroidManifest.xml" `
    -I $androidJar "$out\res.zip" --java "$out\gen" `
    --min-sdk-version 21 --target-sdk-version 34

Write-Host "3/6 javac"
& "$Jdk\bin\javac.exe" --release 8 -encoding UTF-8 -classpath $androidJar -d "$out\classes" `
    "$out\gen\asia\abcdabcd\campuswall\R.java" "$here\src\asia\abcdabcd\campuswall\MainActivity.java"

Write-Host "4/6 d8"
$env:JAVA_HOME = $Jdk
$files = (Get-ChildItem -Recurse "$out\classes" -Filter *.class).FullName
& "$BuildTools\d8.bat" --lib $androidJar --min-api 21 --output "$out\dex" $files

Write-Host "5/6 merge dex + zipalign"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open("$out\base.apk", 'Update')
[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
    $zip, "$out\dex\classes.dex", "classes.dex",
    [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
$zip.Dispose()
& "$BuildTools\zipalign.exe" -f 4 "$out\base.apk" "$out\aligned.apk"

Write-Host "6/6 apksigner"
$target = Join-Path $root "public\downloads\campus-wall-v1.5.apk"
New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
& "$BuildTools\apksigner.bat" sign --ks "$here\campuswall.keystore" `
    --ks-pass pass:campuswall --key-pass pass:campuswall --ks-key-alias campuswall `
    --min-sdk-version 21 --max-sdk-version 34 --out $target "$out\aligned.apk"
& "$BuildTools\apksigner.bat" verify --min-sdk-version 21 $target

Write-Host "完成: $target"
