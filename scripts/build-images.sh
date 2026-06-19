#!/usr/bin/env bash
# Builds and (optionally) pushes the 5 application images for Kubernetes.
# Usage:
#   ./scripts/build-images.sh                  # build only
#   PUSH=1 ./scripts/build-images.sh           # build + push
#   REGISTRY=ghcr.io/me TAG=v1 PUSH=1 ./scripts/build-images.sh
set -euo pipefail

REGISTRY="${REGISTRY:-ghcr.io/selvamagesh303-dev}"
TAG="${TAG:-latest}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

build() {
  local name="$1" ctx="$2" svc="${3:-}"
  local ref="$REGISTRY/$name:$TAG"
  echo ">> building $ref"
  if [[ -n "$svc" ]]; then
    docker build -t "$ref" --build-arg "SERVICE=$svc" "$ctx"
  else
    docker build -t "$ref" "$ctx"
  fi
  if [[ "${PUSH:-0}" == "1" ]]; then
    echo ">> pushing $ref"
    docker push "$ref"
  fi
}

build apm-gateway-service    "$ROOT/microservices" gateway-service
build apm-order-service      "$ROOT/microservices" order-service
build apm-inventory-service  "$ROOT/microservices" inventory-service
build apm-dashboard-backend  "$ROOT/dashboard/backend"
build apm-dashboard-frontend "$ROOT/dashboard/frontend"

echo "Done."
