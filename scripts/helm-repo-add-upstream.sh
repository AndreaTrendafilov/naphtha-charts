#!/usr/bin/env bash
# Add curated upstream Helm repositories (HTTP index only).
# OCI installs (e.g. Strimzi) are documented in docs/curated-upstream-helm.md
set -euo pipefail

repos=(
  "cnpg https://cloudnative-pg.github.io/charts"
  "percona https://percona.github.io/percona-helm-charts/"
  "mongodb https://mongodb.github.io/helm-charts"
  "k8ssandra https://helm.k8ssandra.io/stable"
  "opensearch https://opensearch-project.github.io/helm-charts/"
  "nats https://nats-io.github.io/k8s/helm/charts/"
  "apache-pulsar https://pulsar.apache.org/charts"
  "prometheus-community https://prometheus-community.github.io/helm-charts"
  "grafana https://grafana.github.io/helm-charts"
  "jaegertracing https://jaegertracing.github.io/helm-charts"
  "jetstack https://charts.jetstack.io"
  "ingress-nginx https://kubernetes.github.io/ingress-nginx"
  "traefik https://traefik.github.io/charts"
  "external-dns https://kubernetes-sigs.github.io/external-dns/"
  "external-secrets https://charts.external-secrets.io"
  "minio-operator https://operator.min.io"
)

for entry in "${repos[@]}"; do
  name="${entry%% *}"
  url="${entry#* }"
  helm repo add "$name" "$url" --force-update
done

helm repo update
echo "Done. Strimzi (OCI): helm install ... oci://quay.io/strimzi-helm/strimzi-kafka-operator"
echo "See docs/curated-upstream-helm.md for chart names and notes."
