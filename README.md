# naphtha-charts

Helm chart sources for [naphtha.dev](https://naphtha.dev/). All charts live under **`charts/`**; packaged releases and **`index.yaml`** for `helm repo add` are under **`helm-index/`**.

| Chart | Description |
|-------|-------------|
| **migrations-operator** | Database migrations operator |
| **rocketchat** | Umbrella over [Rocket.Chat official chart](https://rocketchat.github.io/helm-charts) (dependency vendored in `charts/rocketchat/charts/`) |
| **jellyfin** | Jellyfin media server (Deployment + PVC + Ingress) |

## Use the Helm repository

**Canonical URL (Worker + dedicated hostname):**

```bash
helm repo add naphtha https://charts.naphtha.dev
helm repo update
helm search repo naphtha
```

- Index: `https://charts.naphtha.dev/index.yaml`
- Charts: `https://charts.naphtha.dev/<chart>-<version>.tgz`

**Why not `https://naphtha.dev/charts`?** If the apex `naphtha.dev` is **Cloudflare Pages** (or a SPA), it usually owns **all paths**, so `/charts/index.yaml` returns your HTML shell — not YAML. A **subdomain** (`charts.naphtha.dev`) is attached only to this Worker, so Helm gets real files.

**Fallback (no Worker / DNS yet):** use GitHub raw:

```bash
helm repo add naphtha 'https://raw.githubusercontent.com/AndreaTrendafilov/naphtha-charts/main/helm-index'
```

## Work on a chart

Edit sources under `charts/<name>/`, then refresh packages and the repo index:

```bash
helm package charts/migrations-operator -d helm-index
helm package charts/jellyfin -d helm-index
helm package charts/rocketchat -d helm-index
helm repo index helm-index --url https://charts.naphtha.dev
```

Commit `charts/` and `helm-index/` together.

## Cloudflare Worker (`charts.naphtha.dev`)

The Worker (`workers/helm-charts-proxy/`) proxies to:

`https://raw.githubusercontent.com/AndreaTrendafilov/naphtha-charts/main/helm-index/<file>`

After you push `helm-index/` to `main`, clients see new charts (short cache on `index.yaml`).

### One-time setup

1. **API token** with Workers edit + repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
2. **Deploy** the Worker (GitHub Action **Deploy Helm charts worker** or `cd workers/helm-charts-proxy && npm ci && npx wrangler deploy`).
3. **Custom domain on the Worker** (not only a route on apex):
   - Workers & Pages → **naphtha-helm-charts-proxy** → **Settings** → **Domains & Routes** → **Add** → **Custom domain** → `charts.naphtha.dev`
   - Cloudflare DNS should get the required record automatically (proxied).

Optional: apex path `naphtha.dev/charts/*` only works if a **Worker route** is evaluated **before** Pages for that path; subdomains avoid that fight.

### Changing GitHub org/repo/branch

Edit `[vars]` in `workers/helm-charts-proxy/wrangler.toml` and redeploy.

## Defaults

- **Jellyfin:** `jellyfin.naphtha.dev` (change `charts/jellyfin/values.yaml`).
- **Rocket.Chat:** `chat.naphtha.dev`, upstream app ~8.2 / chart 6.32.1.
- **Migrations operator:** `ghcr.io/andreatrendafilov/migrations-operator:v1.2.5`.

Set MongoDB and other secrets via your own values overlays before production.
