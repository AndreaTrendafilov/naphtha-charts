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

## Publish `helm-index` at `https://naphtha.dev/charts` (Cloudflare Worker)

The repo includes a small **Cloudflare Worker** (`workers/helm-charts-proxy/`) that proxies:

`https://naphtha.dev/charts/<file>` → `https://raw.githubusercontent.com/AndreaTrendafilov/naphtha-charts/main/helm-index/<file>`

So you **do not** upload tarballs to R2 or Pages: after you push `helm-index/` to `main`, clients see new charts (subject to short CDN cache on `index.yaml`). No separate “publish index” step beyond `git push`.

### One-time Cloudflare setup

1. Create an **API token** with *Edit Cloudflare Workers* (and account read). Add repo secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID` (Workers overview in the dashboard)
2. Run **Deploy Helm charts worker** (GitHub Actions) or locally:

   ```bash
   cd workers/helm-charts-proxy
   npm ci
   npx wrangler login   # or use CLOUDFLARE_API_TOKEN in env
   npx wrangler deploy
   ```

3. **Attach a route** so only `/charts` hits this worker (leave the rest of `naphtha.dev` on Pages or your current host):
   - Workers & Pages → `naphtha-helm-charts-proxy` → **Triggers** → **Add route** → `naphtha.dev/charts*`
   - Put this route **above** a catch-all `naphtha.dev/*` if you use multiple workers.

The workflow `.github/workflows/deploy-helm-worker.yml` deploys the worker when `workers/helm-charts-proxy/**` changes.

### Changing GitHub org/repo/branch

Edit `[vars]` in `workers/helm-charts-proxy/wrangler.toml` and redeploy.

## Defaults

- **Jellyfin:** `jellyfin.naphtha.dev` (change `charts/jellyfin/values.yaml`).
- **Rocket.Chat:** `chat.naphtha.dev`, upstream app ~8.2 / chart 6.32.1.
- **Migrations operator:** `ghcr.io/andreatrendafilov/migrations-operator:v1.2.5`.

Set MongoDB and other secrets via your own values overlays before production.
