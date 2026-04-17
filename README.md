# naphtha-charts

Helm chart sources for [naphtha.dev](https://naphtha.dev/). All charts live under **`charts/`**; packaged releases and **`index.yaml`** for `helm repo add` are under **`helm-index/`**.

| Chart | Description |
|-------|-------------|
| **migrations-operator** | Database migrations operator |
| **rocketchat** | Umbrella over [Rocket.Chat official chart](https://rocketchat.github.io/helm-charts) (dependency vendored in `charts/rocketchat/charts/`) |
| **jellyfin** | Jellyfin media server (Deployment + PVC + Ingress) |
| **redis** | [Official `redis` image](https://hub.docker.com/_/redis) (Deployment + PVC + Service; not Bitnami) |

## Use the Helm repository

**Canonical URL (Worker + dedicated hostname):**

```bash
helm repo add naphtha https://charts.naphtha.dev
helm repo update
helm search repo naphtha
```

- Index: `https://charts.naphtha.dev/index.yaml`
- Charts: `https://charts.naphtha.dev/helm-index/<chart>-<version>.tgz` (also `/helm-index/...` as in `index.yaml`)

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
helm package charts/redis -d helm-index
helm repo index helm-index --url https://charts.naphtha.dev/helm-index
cp helm-index/index.yaml ./index.yaml
```

Commit `charts/`, `helm-index/`, and the repo root `index.yaml` together.

## Cloudflare Worker (`charts.naphtha.dev`)

The Worker (`workers/helm-charts-proxy/`) serves **`index.yaml`** from the repo root and **`helm-index/*`** for packaged charts.

- **Public repo:** it fetches via `raw.githubusercontent.com` (no token).
- **Private repo:** set a **secret** `GITHUB_TOKEN` on the Worker (see below); it uses the GitHub Contents API with `Accept: application/vnd.github.raw`.

After you push `index.yaml` / `helm-index/` to `main`, clients see new charts (short cache on `index.yaml`).

### GitHub token (private repo only)

1. **Create a token**
   - **Fine-grained PAT** (recommended): GitHub → **Settings** → **Developer settings** → **Fine-grained tokens** → **Generate new**.
     - Resource owner: your user (or org).
     - Repository access: **Only select repositories** → `naphtha-charts`.
     - Permissions → **Repository** → **Contents: Read** (Metadata is included).
   - **Classic PAT:** scope **`repo`** (read-only is enough for public index read on private repo).

2. **Add it to Cloudflare (encrypted)**
   - Workers & Pages → **naphtha-helm-charts-proxy** → **Settings** → **Variables and Secrets** → **Add** → type **Secret** → name **`GITHUB_TOKEN`** → paste the token → **Save**.
   - Or CLI from `workers/helm-charts-proxy/`:  
     `npx wrangler secret put GITHUB_TOKEN`  
     (paste token when prompted.)

3. **Redeploy** the Worker so the binding is active (`npx wrangler deploy` or your GitHub Action).

4. Set the **GitHub repo to Private**; `helm repo add https://charts.naphtha.dev` still works because only the Worker talks to GitHub with the token.

Do **not** commit the token. Rotate it if it leaks.

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
- **Redis:** default image `redis:8.4.2-alpine3.22` ([Docker Hub](https://hub.docker.com/_/redis)); override `image.repository` / `image.tag` as needed.

Set MongoDB and other secrets via your own values overlays before production.
