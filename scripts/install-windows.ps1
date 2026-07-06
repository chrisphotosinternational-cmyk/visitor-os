$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RootDir

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker Desktop is required on Windows."
}

docker compose version | Out-Null

$EnvFile = Join-Path $RootDir "deployment\.env.production"
$EnvExample = Join-Path $RootDir "deployment\.env.production.example"

if (-not (Test-Path $EnvFile)) {
  Copy-Item $EnvExample $EnvFile
  Write-Host "Created deployment\.env.production. Edit secrets before production use."
}

docker compose --env-file deployment/.env.production -f deployment/docker-compose.yml -f deployment/docker-compose.production.yml up -d --build
bash scripts/healthcheck.sh

