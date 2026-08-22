# Prompt OS — one-command install (Windows PowerShell)
$ErrorActionPreference = "Stop"
$Repo = if ($env:PROMPT_OS_REPO) { $env:PROMPT_OS_REPO } else { "https://github.com/youtextme/prompt-operating-system.git" }
$Branch = if ($env:PROMPT_OS_BRANCH) { $env:PROMPT_OS_BRANCH } else { "main" }
$Tmp = Join-Path $env:TEMP ("pos-install-" + [guid]::NewGuid().ToString("n"))

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js 20+ required. Install from https://nodejs.org/"
}

New-Item -ItemType Directory -Path $Tmp -Force | Out-Null
try {
  git clone --depth 1 --branch $Branch $Repo (Join-Path $Tmp "repo") 2>$null
  if ($LASTEXITCODE -eq 0) {
    node (Join-Path $Tmp "repo\install.mjs") @args
  } else {
    $Zip = Join-Path $Tmp "repo.zip"
    Invoke-WebRequest -Uri "https://github.com/youtextme/prompt-operating-system/archive/refs/heads/$Branch.zip" -OutFile $Zip
    Expand-Archive -Path $Zip -DestinationPath $Tmp -Force
    $Extracted = Get-ChildItem $Tmp -Directory | Where-Object { $_.Name -like "prompt-operating-system*" } | Select-Object -First 1
    node (Join-Path $Extracted.FullName "install.mjs") @args
  }
} finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
