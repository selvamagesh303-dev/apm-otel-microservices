#!/usr/bin/env bash
# Generates traffic through the gateway so traces/metrics show up in the APM UIs.
# Usage:  ./scripts/load-test.sh [count]
set -euo pipefail

COUNT="${1:-50}"
BASE_URL="${BASE_URL:-http://localhost:8080}"
SKUS=("SKU-001" "SKU-002" "SKU-003" "SKU-404")  # SKU-404 is unknown -> BACKORDERED

for ((i = 1; i <= COUNT; i++)); do
  sku="${SKUS[$RANDOM % ${#SKUS[@]}]}"
  status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/checkout/$sku" || echo "ERR")
  printf "[%3d] %s -> HTTP %s\n" "$i" "$sku" "$status"
  sleep 0.2
done

echo
echo "Done. Open Jaeger: http://localhost:16686 (service: gateway-service)"
