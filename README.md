# naphtha-charts

Helm chart sources for [naphtha.dev](https://naphtha.dev/). All charts live under **`charts/`**; packaged releases and **`index.yaml`** for `helm repo add` are under **`helm-index/`**.

| Chart | Description |
|-------|-------------|
| **migrations-operator** | Database migrations operator |
| **rocketchat** | Umbrella over [Rocket.Chat official chart](https://rocketchat.github.io/helm-charts) (dependency vendored in `charts/rocketchat/charts/`) |
| **jellyfin** | Jellyfin media server (Deployment + PVC + Ingress) |

## Use the Helm repository

Serve **`helm-index/`** at **`https://naphtha.dev/charts/`** so these URLs work:

- `https://naphtha.dev/charts/index.yaml`
- `https://naphtha.dev/charts/*.tgz`

```bash
helm repo add naphtha https://naphtha.dev/charts
helm repo update
helm search repo naphtha
```

## Work on a chart

Edit sources under `charts/<name>/`, then refresh packages and the repo index:

```bash
# Rocket.Chat: refresh upstream dependency when bumping Chart.yaml
helm dependency update charts/rocketchat

helm package charts/migrations-operator -d helm-index
helm package charts/jellyfin -d helm-index
helm package charts/rocketchat -d helm-index
helm repo index helm-index --url https://naphtha.dev/charts
```

Commit `charts/` and `helm-index/` together.

## Defaults

- **Jellyfin:** `jellyfin.naphtha.dev` (change `charts/jellyfin/values.yaml`).
- **Rocket.Chat:** `chat.naphtha.dev`, upstream app ~8.2 / chart 6.32.1.
- **Migrations operator:** `ghcr.io/andreatrendafilov/migrations-operator:v1.2.5`.

Set MongoDB and other secrets via your own values overlays before production.
