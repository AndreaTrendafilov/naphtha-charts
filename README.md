# naphtha-charts

Helm chart sources for [naphtha.dev](https://naphtha.dev/). All charts live under **`charts/`**; packaged releases and **`index.yaml`** for `helm repo add` are under **`helm-index/`**.

| Chart | Description |
|-------|-------------|
| **migrations-operator** | Database migrations operator |
| **rocketchat** | Umbrella over [Rocket.Chat official chart](https://rocketchat.github.io/helm-charts) (dependency vendored in `charts/rocketchat/charts/`) |
| **jellyfin** | Jellyfin media server (Deployment + PVC + Ingress) |
| **redis** | [Official `redis` image](https://hub.docker.com/_/redis) (Deployment + PVC + Service; not Bitnami) |
| **kafka** | [Official `apache/kafka`](https://hub.docker.com/r/apache/kafka) JVM image, single-node KRaft (StatefulSet; not Bitnami) |

### Umbrella charts (upstream Helm dependency + vendored `charts/*.tgz`)

Install with `helm install myrel naphtha/<chart>` after `helm repo update`. Override values under the **upstream subchart key** (see each `values.yaml`). Pin versions are in `Chart.yaml`; refresh vendored deps with `helm dependency update charts/<name>` after editing.

| Chart | Upstream chart / notes |
|-------|-------------------------|
| **cloudnative-pg** | [CloudNativePG operator](https://cloudnative-pg.io/) |
| **percona-pxc-operator** | [Percona XtraDB cluster operator](https://docs.percona.com/) |
| **mongodb-community-operator** | [MongoDB community operator](https://github.com/mongodb/mongodb-kubernetes-operator) |
| **k8ssandra-operator** | [K8ssandra operator](https://k8ssandra.io/) |
| **opensearch** | [OpenSearch](https://opensearch.org/) |
| **nats** | [NATS](https://nats.io/) |
| **pulsar** | [Apache Pulsar](https://pulsar.apache.org/) (heavy footprint) |
| **kube-prometheus-stack** | [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts) |
| **loki** | [Grafana Loki](https://grafana.com/oss/loki/) (defaults tuned for small/lab; set storage for prod) |
| **tempo** | [Grafana Tempo](https://grafana.com/oss/tempo/) |
| **jaeger** | [Jaeger](https://www.jaegertracing.io/) |
| **cert-manager** | [cert-manager](https://cert-manager.io/) |
| **ingress-nginx** | [ingress-nginx](https://kubernetes.github.io/ingress-nginx/) |
| **traefik** | [Traefik](https://traefik.io/) |
| **external-dns** | [ExternalDNS](https://github.com/kubernetes-sigs/external-dns) |
| **external-secrets** | [External Secrets](https://external-secrets.io/) |
| **minio-operator** | [MinIO operator](https://min.io/) |
| **strimzi-kafka-operator** | [Strimzi](https://strimzi.io/) (OCI dependency) |

Vendor-only `helm repo add` (for browsing upstream indexes locally) is still in **[docs/curated-upstream-helm.md](docs/curated-upstream-helm.md)** and `./scripts/helm-repo-add-upstream.sh`.

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

Edit sources under `charts/<name>/`. For umbrellas, run `helm dependency update charts/<name>` after changing `Chart.yaml` dependencies.

Repackage **everything** into `helm-index/` and sync the root index:

```bash
python3 scripts/bump-chart-images.py repackage
```

To **bootstrap or refresh** all upstream umbrellas from pinned versions in `scripts/bootstrap-upstream-charts.py`:

```bash
python3 scripts/bootstrap-upstream-charts.py
```

Commit `charts/` (including `charts/*/charts/*.tgz`), `helm-index/`, and the repo root `index.yaml` together.

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
- **Rocket.Chat:** `chat.naphtha.dev`, upstream app ~8.3 / chart 6.32.1 (image tag bumped via nightly job from [GitHub releases](https://github.com/RocketChat/Rocket.Chat/releases)).
- **Migrations operator:** `ghcr.io/andreatrendafilov/migrations-operator:v1.2.5`.
- **Redis:** default image `redis:8.4.2-alpine3.22` ([Docker Hub](https://hub.docker.com/_/redis)); override `image.repository` / `image.tag` as needed.
- **Kafka:** default image `apache/kafka:4.2.0` ([Docker Hub](https://hub.docker.com/r/apache/kafka)); single combined KRaft node only. For multi-broker production clusters, use [Strimzi](https://strimzi.io/) or a vendor chart instead of this minimal chart.

Set MongoDB and other secrets via your own values overlays before production.
