# Curated upstream Helm charts

These projects are **maintained outside** this repo. Add the vendor Helm repository (or use the OCI install), then `helm install` from upstream — they are **not** listed in the naphtha `helm-index/` (unlike `charts/redis`, `charts/kafka`, etc.).

Pin versions in production (`helm search repo --versions <chart>` or [Artifact Hub](https://artifacthub.io/)).

## Databases & data stores

| Software | Helm repo | Chart / notes |
|----------|-----------|----------------|
| **PostgreSQL** ([CloudNativePG](https://cloudnative-pg.io/)) | `helm repo add cnpg https://cloudnative-pg.github.io/charts` | Chart `cloudnative-pg` (operator). Then create `Cluster` CRs. |
| **MySQL / Percona** | `helm repo add percona https://percona.github.io/percona-helm-charts/` | Charts such as `pxc-db`, `pxc-operator` — see repo README. |
| **MongoDB** ([community operator](https://github.com/mongodb/mongodb-kubernetes-operator)) | `helm repo add mongodb https://mongodb.github.io/helm-charts` | Chart `community-operator` (name may vary by release). |
| **Cassandra** ([K8ssandra](https://k8ssandra.io/)) | `helm repo add k8ssandra https://helm.k8ssandra.io/stable` | Operator / stack charts — follow current K8ssandra install docs. |
| **ClickHouse** ([Altinity operator](https://github.com/Altinity/clickhouse-operator)) | Often installed via manifest or [Altinity Helm](https://github.com/Altinity/helm-charts) — check Artifact Hub for `altinity-clickhouse-operator`. |
| **OpenSearch** | `helm repo add opensearch https://opensearch-project.github.io/helm-charts/` | Charts `opensearch`, `opensearch-dashboards`. |

## Messaging & streaming

| Software | Install | Notes |
|----------|---------|--------|
| **Kafka** ([Strimzi](https://strimzi.io/)) | `helm install strimzi-kafka-operator oci://quay.io/strimzi-helm/strimzi-kafka-operator` | OCI chart (no classic `helm repo add`). Operator + `Kafka` CRs. Prefer this over single-node dev charts for HA. |
| **NATS** | `helm repo add nats https://nats-io.github.io/k8s/helm/charts/` | Chart `nats`; see also `nack` etc. |
| **Apache Pulsar** | `helm repo add apache-pulsar https://pulsar.apache.org/charts` | Chart `pulsar` — resource-heavy; see [upstream Helm docs](https://pulsar.apache.org/docs/helm-overview/). |
| **RabbitMQ** ([Kubernetes operator](https://www.rabbitmq.com/kubernetes/operator/operator-overview)) | Often **YAML/kustomize** first; Helm wrappers exist on Artifact Hub — pick a maintained publisher. |

## Observability

| Software | Helm repo | Chart |
|----------|-----------|--------|
| **Prometheus + Grafana stack** | `helm repo add prometheus-community https://prometheus-community.github.io/helm-charts` | `kube-prometheus-stack` |
| **Loki** | `helm repo add grafana https://grafana.github.io/helm-charts` | `loki`, `loki-stack` (legacy) — follow Grafana docs. |
| **Tempo** | `helm repo add grafana https://grafana.github.io/helm-charts` | `tempo` |
| **Jaeger** | `helm repo add jaegertracing https://jaegertracing.github.io/helm-charts` | `jaeger` |

## Cluster glue & ingress

| Software | Helm repo | Chart |
|----------|-----------|--------|
| **cert-manager** | `helm repo add jetstack https://charts.jetstack.io --force-update` | `cert-manager` |
| **ingress-nginx** | `helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx` | `ingress-nginx` |
| **Traefik** | `helm repo add traefik https://traefik.github.io/charts` | `traefik` |
| **ExternalDNS** | `helm repo add external-dns https://kubernetes-sigs.github.io/external-dns/` | `external-dns` |
| **External Secrets** | `helm repo add external-secrets https://charts.external-secrets.io` | `external-secrets` |

## Object storage

| Software | Helm repo | Chart |
|----------|-----------|--------|
| **MinIO operator** | `helm repo add minio-operator https://operator.min.io` | `operator`, `tenant` — see [MinIO Operator docs](https://min.io/docs/minio/kubernetes/upstream/index.html). |

## Example: one-liner after adding repos

```bash
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install cnpg-operator cnpg/cloudnative-pg --namespace cnpg-system --create-namespace
```

Use **values files** and **namespace** isolation for anything beyond a lab.

## Why not Bitnami for everything?

Bitnami’s [public catalog policy changed](https://github.com/bitnami/charts/issues/35164); many images moved or are legacy. Prefer **project-owned** charts (CloudNativePG, Strimzi, Grafana, Jetstack, CNCF) when you can.
