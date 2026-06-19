# Kubernetes deployment

Kustomize manifests to run the whole APM stack (both projects + observability
backend) on any Kubernetes cluster — local (kind / minikube / Docker Desktop) or
cloud.

```
k8s/
├── kustomization.yaml     # namespace, ConfigMap generators, image overrides
├── namespace.yaml         # namespace: apm
├── configmaps.yaml        # collector / Prometheus / Grafana config
├── clickhouse.yaml        # StatefulSet + PVC + Service
├── otel-collector.yaml    # Deployment + Service
├── jaeger.yaml
├── prometheus.yaml
├── grafana.yaml
├── microservices.yaml     # gateway / order / inventory  (Project 1)
└── dashboard.yaml         # FastAPI backend + Next.js frontend (Project 2)
```

The ConfigMaps in `configmaps.yaml` mirror the files in [`../otel/`](../otel/) that
Docker Compose uses (kept inline so `kubectl apply -k k8s/` works without relaxing
Kustomize's load restrictor). If you edit `../otel/*`, mirror the change here.

## 1. Build & push images

Kubernetes can't build from a Dockerfile like Compose does, so the 5 app images
must exist in a registry your cluster can pull from.

```powershell
# Build + push to your registry (defaults to ghcr.io/selvamagesh303-dev)
./scripts/build-images.ps1 -Push
```
```bash
PUSH=1 ./scripts/build-images.sh
```

Then point the manifests at your registry/tag (edit `k8s/kustomization.yaml`
`images:` block, or):

```bash
cd k8s && kustomize edit set image \
  apm-gateway-service=ghcr.io/ME/apm-gateway-service:v1   # ...repeat per image
```

### Local clusters (no registry needed)
With **kind**, build then load images straight into the cluster:
```bash
./scripts/build-images.sh
for img in gateway-service order-service inventory-service dashboard-backend dashboard-frontend; do
  kind load docker-image ghcr.io/selvamagesh303-dev/apm-$img:latest
done
```
(For minikube use `minikube image load <ref>`.)

## 2. Deploy

```bash
kubectl apply -k k8s/
kubectl -n apm get pods -w        # wait until all are Running/Ready
```

ClickHouse comes up first (StatefulSet); the OTel Collector and services follow.

## 3. Access the UIs

Services are `ClusterIP`. Port-forward the ones you want (these ports match the
frontend's baked `NEXT_PUBLIC_API_URL=http://localhost:8000`, so the dashboard
works as-is):

```bash
kubectl -n apm port-forward svc/dashboard-frontend 3000:3000 &
kubectl -n apm port-forward svc/dashboard-backend  8000:8000 &
kubectl -n apm port-forward svc/gateway-service    8080:8080 &
kubectl -n apm port-forward svc/jaeger             16686:16686 &
```

Generate traffic, then open the dashboard at http://localhost:3000:

```bash
./scripts/load-test.sh 80
```

> For permanent external access instead of port-forward, add an Ingress for
> `dashboard-frontend` and `dashboard-backend`, and rebuild the frontend image
> with `NEXT_PUBLIC_API_URL` set to the backend's public URL.

## 4. Tear down

```bash
kubectl delete -k k8s/
```

## Notes
- ClickHouse uses a 5Gi PVC — your cluster needs a default StorageClass.
- Resource requests are modest (demo-sized); tune in each manifest for real load.
- The OTel Java agent is baked into the microservice images, so no init container
  or sidecar is needed — only `OTEL_*` env vars (set in `microservices.yaml`).
