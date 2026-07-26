param(
    [string] $InstallSlug = 'omfit-seo-bridge',
    [string] $OutputName = 'omfit-seo-bridge.zip'
)

$ErrorActionPreference = 'Stop'

$wordpressDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pluginName = 'omfit-seo-bridge'
$pluginDir = Join-Path $wordpressDir $pluginName
$zipPath = Join-Path $wordpressDir $OutputName

if (-not (Test-Path -LiteralPath $pluginDir -PathType Container)) {
    throw "Plugin directory not found: $pluginDir"
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath
}

$archive = [System.IO.Compression.ZipFile]::Open(
    $zipPath,
    [System.IO.Compression.ZipArchiveMode]::Create
)

try {
    Get-ChildItem -LiteralPath $pluginDir -Recurse -File | ForEach-Object {
        $relativePath = $_.FullName.Substring($pluginDir.Length).TrimStart('\', '/')
        $entryName = "$InstallSlug/$($relativePath.Replace('\', '/'))"
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive,
            $_.FullName,
            $entryName,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
}
finally {
    $archive.Dispose()
}

Write-Output "Built WordPress-compatible plugin: $zipPath"
