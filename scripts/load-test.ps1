# Generates traffic through the gateway so traces/metrics show up in the APM UIs.
# Usage:  ./scripts/load-test.ps1 -Count 50
param(
    [int]$Count = 50,
    [string]$BaseUrl = "http://localhost:8080"
)

$skus = @("SKU-001", "SKU-002", "SKU-003", "SKU-404")  # SKU-404 is unknown -> BACKORDERED
for ($i = 1; $i -le $Count; $i++) {
    $sku = $skus | Get-Random
    try {
        $resp = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/checkout/$sku" -TimeoutSec 10
        Write-Host ("[{0,3}] {1} -> {2}" -f $i, $sku, $resp.status)
    } catch {
        Write-Host ("[{0,3}] {1} -> ERROR {2}" -f $i, $sku, $_.Exception.Message) -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 200
}
Write-Host "`nDone. Open Jaeger: http://localhost:16686 (service: gateway-service)" -ForegroundColor Green
