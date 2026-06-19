# Builds and (optionally) pushes the 5 application images for Kubernetes.
# Usage:
#   ./scripts/build-images.ps1                       # build only
#   ./scripts/build-images.ps1 -Push                 # build + push
#   ./scripts/build-images.ps1 -Registry ghcr.io/me -Tag v1 -Push
param(
    [string]$Registry = "ghcr.io/selvamagesh303-dev",
    [string]$Tag = "latest",
    [switch]$Push
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

# name -> @(context, service-build-arg-or-empty)
$images = @{
    "apm-gateway-service"   = @("$root/microservices", "gateway-service")
    "apm-order-service"     = @("$root/microservices", "order-service")
    "apm-inventory-service" = @("$root/microservices", "inventory-service")
    "apm-dashboard-backend" = @("$root/dashboard/backend", "")
    "apm-dashboard-frontend"= @("$root/dashboard/frontend", "")
}

foreach ($name in $images.Keys) {
    $ctx, $svc = $images[$name]
    $ref = "$Registry/${name}:$Tag"
    Write-Host "Building $ref" -ForegroundColor Cyan
    if ($svc) {
        docker build -t $ref --build-arg "SERVICE=$svc" $ctx
    } else {
        docker build -t $ref $ctx
    }
    if ($Push) {
        Write-Host "Pushing $ref" -ForegroundColor Cyan
        docker push $ref
    }
}
Write-Host "Done." -ForegroundColor Green
