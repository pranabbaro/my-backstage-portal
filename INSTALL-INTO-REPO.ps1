param(
  [string]$RepoPath = "."
)

$ErrorActionPreference = "Stop"

$repo = (Resolve-Path $RepoPath).Path
if (-not (Test-Path (Join-Path $repo "backstage\package.json"))) {
  throw "This does not look like my-backstage-portal. backstage\package.json was not found."
}

$pack = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Installing final Backstage App Service files into: $repo"

New-Item -ItemType Directory -Force -Path (Join-Path $repo ".github\workflows") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $repo "backstage\deploy") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $repo "backstage\examples\infrastructure-template") | Out-Null

Copy-Item (Join-Path $pack ".github\workflows\deploy-backstage-appservice.yml") `
  (Join-Path $repo ".github\workflows\deploy-backstage-appservice.yml") -Force

Copy-Item (Join-Path $pack "backstage\app-config.production.appservice.yaml") `
  (Join-Path $repo "backstage\app-config.production.appservice.yaml") -Force

Copy-Item (Join-Path $pack "backstage\deploy\startup.sh") `
  (Join-Path $repo "backstage\deploy\startup.sh") -Force

Copy-Item (Join-Path $pack "backstage\examples\infrastructure-template\template.yaml") `
  (Join-Path $repo "backstage\examples\infrastructure-template\template.yaml") -Force

$old = Join-Path $repo ".github\workflows\main_backstage-pranab-mvp.yml"
if (Test-Path $old) {
  Remove-Item $old -Force
  Write-Host "Removed duplicate old Azure workflow."
}

Write-Host ""
Write-Host "Installation complete."
Write-Host "Now run:"
Write-Host "  git add ."
Write-Host '  git commit -m "Final Backstage App Service deployment"'
Write-Host "  git pull --rebase origin main"
Write-Host "  git push origin main"
