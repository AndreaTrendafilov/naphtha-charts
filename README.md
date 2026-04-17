# naphtha-charts

Helm chart sources and deployment values for [naphtha.dev](https://naphtha.dev/).

| Path | Purpose |
|------|---------|
| `charts/` | Application charts (e.g. Rocket.Chat, wg-easy) used with Argo CD |
| `apps/` | Per-environment values and Argo CD app configs |
| `argocdconfigs/` | Argo CD `ApplicationSet` / project wiring |
| `chart-sources/migrations-operator/` | Source for the **migrations-operator** chart |
| `helm-index/` | Packaged chart + `index.yaml` for the public Helm HTTP repository |

## Helm repository (HTTPS)

Published chart packages are in **`helm-index/`**. For `helm repo add` to work, serve that directory at **`https://naphtha.dev/charts/`** (so `index.yaml` and `*.tgz` are reachable at the URLs in `helm-index/index.yaml`).

```bash
helm repo add naphtha https://naphtha.dev/charts
helm repo update
helm search repo naphtha
helm install migrations-operator naphtha/migrations-operator --namespace migrations-system --create-namespace
```

### Refresh `helm-index/` after editing `chart-sources/`

```bash
helm package chart-sources/migrations-operator -d helm-index
helm repo index helm-index --url https://naphtha.dev/charts
```

Then commit `helm-index/` and redeploy the static files behind [naphtha.dev](https://naphtha.dev/).

Default operator image: `ghcr.io/andreatrendafilov/migrations-operator:v1.2.5`.
