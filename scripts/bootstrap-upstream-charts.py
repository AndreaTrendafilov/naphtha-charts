#!/usr/bin/env python3
"""Create umbrella charts under charts/<name>/ with a single Helm dependency (vendor via helm dependency update)."""
from __future__ import annotations

import os
import subprocess
import textwrap

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (directory_name, Chart.yaml name, dependency name, version, repository URL)
UPSTREAMS: list[tuple[str, str, str, str, str]] = [
    (
        "cloudnative-pg",
        "cloudnative-pg",
        "cloudnative-pg",
        "0.28.0",
        "https://cloudnative-pg.github.io/charts",
    ),
    (
        "percona-pxc-operator",
        "percona-pxc-operator",
        "pxc-operator",
        "1.19.1",
        "https://percona.github.io/percona-helm-charts/",
    ),
    (
        "mongodb-community-operator",
        "mongodb-community-operator",
        "community-operator",
        "0.13.0",
        "https://mongodb.github.io/helm-charts",
    ),
    (
        "k8ssandra-operator",
        "k8ssandra-operator",
        "k8ssandra-operator",
        "1.31.0",
        "https://helm.k8ssandra.io/stable",
    ),
    (
        "opensearch",
        "opensearch",
        "opensearch",
        "3.6.0",
        "https://opensearch-project.github.io/helm-charts/",
    ),
    ("nats", "nats", "nats", "2.12.6", "https://nats-io.github.io/k8s/helm/charts/"),
    ("pulsar", "pulsar", "pulsar", "4.5.0", "https://pulsar.apache.org/charts"),
    (
        "kube-prometheus-stack",
        "kube-prometheus-stack",
        "kube-prometheus-stack",
        "83.5.1",
        "https://prometheus-community.github.io/helm-charts",
    ),
    ("loki", "loki", "loki", "6.55.0", "https://grafana.github.io/helm-charts"),
    ("tempo", "tempo", "tempo", "1.24.4", "https://grafana.github.io/helm-charts"),
    (
        "jaeger",
        "jaeger",
        "jaeger",
        "4.7.0",
        "https://jaegertracing.github.io/helm-charts",
    ),
    (
        "cert-manager",
        "cert-manager",
        "cert-manager",
        "v1.20.2",
        "https://charts.jetstack.io",
    ),
    (
        "ingress-nginx",
        "ingress-nginx",
        "ingress-nginx",
        "4.15.1",
        "https://kubernetes.github.io/ingress-nginx",
    ),
    ("traefik", "traefik", "traefik", "39.0.8", "https://traefik.github.io/charts"),
    (
        "external-dns",
        "external-dns",
        "external-dns",
        "1.20.0",
        "https://kubernetes-sigs.github.io/external-dns/",
    ),
    (
        "external-secrets",
        "external-secrets",
        "external-secrets",
        "2.3.0",
        "https://charts.external-secrets.io",
    ),
    (
        "minio-operator",
        "minio-operator",
        "operator",
        "7.1.1",
        "https://operator.min.io",
    ),
    (
        "strimzi-kafka-operator",
        "strimzi-kafka-operator",
        "strimzi-kafka-operator",
        "0.51.0",
        "oci://quay.io/strimzi-helm",
    ),
]


def chart_yaml(
    name: str, dep: str, dep_version: str, repo: str, description: str
) -> str:
    repo_yaml = repo if repo.startswith("oci://") else f'"{repo}"'
    return textwrap.dedent(
        f"""\
        apiVersion: v2
        name: {name}
        description: {description}
        type: application
        version: 1.0.0
        appVersion: "{dep_version}"

        dependencies:
          - name: {dep}
            version: "{dep_version}"
            repository: {repo_yaml}
        """
    )


def main() -> None:
    os.chdir(REPO_ROOT)
    for folder, cname, dep, ver, repo in UPSTREAMS:
        desc = f"Umbrella over upstream `{dep}` (naphtha defaults)"
        chart_dir = os.path.join(REPO_ROOT, "charts", folder)
        os.makedirs(chart_dir, mode=0o755, exist_ok=True)
        cy = chart_yaml(cname, dep, ver, repo, desc)
        with open(os.path.join(chart_dir, "Chart.yaml"), "w", encoding="utf-8") as f:
            f.write(cy)
        values_key = dep
        values_content = textwrap.dedent(
            f"""\
            # Values passed to the upstream `{dep}` subchart (Chart.yaml dependency).
            {values_key}: {{}}
            """
        )
        with open(os.path.join(chart_dir, "values.yaml"), "w", encoding="utf-8") as f:
            f.write(values_content)
        print(f"charts/{folder}: helm dependency update …")
        subprocess.run(
            ["helm", "dependency", "update", chart_dir],
            check=True,
            cwd=REPO_ROOT,
        )


if __name__ == "__main__":
    main()
