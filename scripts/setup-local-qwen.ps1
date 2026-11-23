# Isolated Windows authoring tools. No administrator rights or game dependencies.
param([ValidateSet('VoiceDesign', 'Base')][string]$Variant = 'VoiceDesign')

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$localRoot = Join-Path $repoRoot 'artifacts/voice/local-qwen'
$runtimeRoot = Join-Path $localRoot 'runtime'
$version = 'v0.9.5'
$archive = Join-Path $runtimeRoot 'audio-v0.9.5-windows-vulkan-portable.zip'
$archiveHash = '6c304c9a1e0cfc18b2d3b208b03d40365fec71d094ee4da4f695b2d9e7de29e8'
$modelId = "Qwen/Qwen3-TTS-12Hz-1.7B-$Variant"
$revision = if ($Variant -eq 'Base') { 'fd4b254389122332181a7c3db7f27e918eec64e3' } else { '5ecdb67327fd37bb2e042aab12ff7391903235d3' }
$modelRoot = Join-Path $localRoot "models/Qwen3-TTS-12Hz-1.7B-$Variant"
New-Item -ItemType Directory -Force $runtimeRoot, $modelRoot | Out-Null

function Receive-File([string]$Url, [string]$Destination) {
    New-Item -ItemType Directory -Force (Split-Path $Destination) | Out-Null
    & curl.exe --fail --location --retry 2 --connect-timeout 30 --speed-limit 1024 --speed-time 120 --continue-at - --output $Destination $Url
    if ($LASTEXITCODE -ne 0) { throw "Download failed: $Destination. Re-run to resume." }
}

if (-not (Test-Path -LiteralPath $archive) -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $archiveHash) {
    Receive-File "https://github.com/0xShug0/audio.cpp/releases/download/$version/audio-$version-bin-windows-x64-vulkan-portable.zip" $archive
}
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $archiveHash) {
    throw 'Runtime archive checksum mismatch. No executable will be launched.'
}
$runtime = Join-Path $runtimeRoot "$version-portable"
# Reuse the installed runtime when adding another model; it may be synthesizing.
if (-not (Test-Path -LiteralPath (Join-Path $runtime 'audiocpp_cli.exe'))) {
    Expand-Archive -LiteralPath $archive -DestinationPath $runtime -Force
}

$metadataPath = Join-Path $modelRoot 'download-manifest.json'
& curl.exe --fail --location --silent --show-error --retry 2 --connect-timeout 30 --max-time 120 --output $metadataPath "https://huggingface.co/api/models/$modelId/revision/${revision}?blobs=true"
if ($LASTEXITCODE -ne 0) { throw 'Model metadata download failed.' }
$metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
if ($metadata.sha -ne $revision) { throw 'Unexpected model revision.' }
$metadata | ConvertTo-Json -Depth 15 | Set-Content (Join-Path $modelRoot 'download-manifest.json') -Encoding utf8
foreach ($file in $metadata.siblings) {
    if ($file.rfilename -eq '.gitattributes') { continue }
    $destination = [IO.Path]::GetFullPath((Join-Path $modelRoot $file.rfilename))
    if (-not $destination.StartsWith($modelRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Invalid model file path.'
    }
    # The tokenizer weights are identical in these two official revisions.
    $existingTokenizer = Join-Path $localRoot 'models/Qwen3-TTS-12Hz-1.7B-VoiceDesign/speech_tokenizer/model.safetensors'
    if ($Variant -eq 'Base' -and $file.rfilename -eq 'speech_tokenizer/model.safetensors' -and -not (Test-Path -LiteralPath $destination) -and (Test-Path -LiteralPath $existingTokenizer)) {
        if ((Get-FileHash -LiteralPath $existingTokenizer -Algorithm SHA256).Hash.ToLowerInvariant() -eq $file.lfs.sha256) {
            New-Item -ItemType Directory -Force (Split-Path $destination) | Out-Null
            Copy-Item -LiteralPath $existingTokenizer -Destination $destination
        }
    }
    if (-not (Test-Path -LiteralPath $destination) -or (Get-Item -LiteralPath $destination).Length -ne $file.size) {
        Write-Output "Downloading $($file.rfilename)"
        Receive-File "https://huggingface.co/$modelId/resolve/$revision/$($file.rfilename)" $destination
    }
    if ((Get-Item -LiteralPath $destination).Length -ne $file.size) { throw "Size mismatch: $destination" }
    if ($file.lfs.sha256 -and (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.lfs.sha256) {
        throw "Model checksum mismatch: $destination"
    }
}
& (Join-Path $runtime 'audiocpp_cli.exe') --list-devices
if ($LASTEXITCODE -ne 0) { throw 'Runtime device check failed.' }
Write-Output "Qwen3-TTS 1.7B $Variant installed. See docs/voice/LOCAL_QWEN.md."
