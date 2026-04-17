#!/usr/bin/env python3
"""
Nightly bump: compare upstream image tags to charts/*/values.yaml and Chart.yaml appVersion.
Updates files, repackages helm-index/, exits 0 (set CHANGED=1 in env file for CI when changes).
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def http_json(url: str) -> dict | list:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "naphtha-charts-bump/1.0"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def read_file(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def write_file(path: str, content: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def sub_line(pattern: str, repl: str, content: str, count: int = 1) -> tuple[str, int]:
    n = len(re.findall(pattern, content, flags=re.MULTILINE))
    out, k = re.subn(pattern, repl, content, count=count, flags=re.MULTILINE)
    return out, k


def bump_patch_chart_version(chart_yaml: str) -> str:
    m = re.search(r"^version:\s*([\d.]+)\s*$", chart_yaml, re.MULTILINE)
    if not m:
        return chart_yaml
    parts = m.group(1).split(".")
    try:
        parts[-1] = str(int(parts[-1]) + 1)
    except ValueError:
        parts.append("1")
    new_v = ".".join(parts)
    return re.sub(
        r"^version:\s*[\d.]+\s*$",
        f"version: {new_v}",
        chart_yaml,
        count=1,
        flags=re.MULTILINE,
    )


def latest_github_release_tag(repo: str) -> str:
    """repo: 'owner/name' — tag_name from /releases/latest (no leading v)."""
    data = http_json(f"https://api.github.com/repos/{repo}/releases/latest")
    tag = (data.get("tag_name") or "").strip().lstrip("v")
    if not tag:
        raise RuntimeError(f"GitHub API: missing tag_name for {repo}")
    return tag


def latest_migrations_tag() -> str:
    return latest_github_release_tag("AndreaTrendafilov/migrations-operator")


def current_values_tag(values_path: str) -> str:
    text = read_file(values_path)
    m = re.search(r'^\s*tag:\s*"([^"]+)"', text, re.MULTILINE)
    if m:
        return m.group(1)
    m = re.search(r"^\s*tag:\s*(\S+)", text, re.MULTILINE)
    if m:
        return m.group(1).strip("\"'")
    raise RuntimeError(f"no image.tag in {values_path}")


def tags_equivalent(a: str, b: str) -> bool:
    """Compare image tags ignoring optional leading v (v1.2.5 vs 1.2.5)."""

    def norm(t: str) -> str:
        t = t.strip().strip("\"'")
        return t[1:] if len(t) > 1 and t[0] == "v" and t[1].isdigit() else t

    return norm(a) == norm(b)


def latest_jellyfin_semver() -> str:
    data = http_json(
        "https://hub.docker.com/v2/repositories/jellyfin/jellyfin/tags"
        "?page_size=100&ordering=last_updated"
    )
    results = data.get("results") or []
    semver = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")

    def key(name: str) -> tuple[int, int, int]:
        m = semver.match(name)
        if not m:
            return (-1, -1, -1)
        return (int(m.group(1)), int(m.group(2)), int(m.group(3)))

    candidates = [r["name"] for r in results if semver.match(r.get("name", ""))]
    skip = {"latest", "stable", "unstable", "nightly"}
    candidates = [c for c in candidates if c.lower() not in skip]
    if not candidates:
        raise RuntimeError("Docker Hub: no semver tags for jellyfin/jellyfin")
    candidates.sort(key=key, reverse=True)
    return candidates[0]


def update_migrations() -> bool:
    chart_dir = os.path.join(REPO_ROOT, "charts", "migrations-operator")
    values_path = os.path.join(chart_dir, "values.yaml")
    chart_path = os.path.join(chart_dir, "Chart.yaml")

    want = latest_migrations_tag()
    have = current_values_tag(values_path)
    if tags_equivalent(want, have):
        print(f"migrations-operator: already at {have}")
        return False

    print(f"migrations-operator: {have} -> {want}")
    vyaml = read_file(values_path)
    vyaml, _ = sub_line(
        r'^(\s*tag:\s*")[^"]+(")',
        rf'\g<1>{want}\g<2>',
        vyaml,
    )
    write_file(values_path, vyaml)

    app = want[1:] if want.startswith("v") else want
    cy = read_file(chart_path)
    cy, _ = sub_line(
        r'^appVersion:\s*".*"$',
        f'appVersion: "{app}"',
        cy,
    )
    cy = bump_patch_chart_version(cy)
    write_file(chart_path, cy)
    return True


def update_jellyfin() -> bool:
    chart_dir = os.path.join(REPO_ROOT, "charts", "jellyfin")
    values_path = os.path.join(chart_dir, "values.yaml")
    chart_path = os.path.join(chart_dir, "Chart.yaml")

    want = latest_jellyfin_semver()
    have = current_values_tag(values_path)
    if tags_equivalent(want, have):
        print(f"jellyfin: already at {have}")
        return False

    print(f"jellyfin: {have} -> {want}")
    vyaml = read_file(values_path)
    vyaml, _ = sub_line(
        r'^(\s*tag:\s*")[^"]+(")',
        rf'\g<1>{want}\g<2>',
        vyaml,
    )
    write_file(values_path, vyaml)

    cy = read_file(chart_path)
    cy, _ = sub_line(
        r'^appVersion:\s*".*"$',
        f'appVersion: "{want}"',
        cy,
    )
    cy = bump_patch_chart_version(cy)
    write_file(chart_path, cy)
    return True


def update_rocketchat() -> bool:
    """Bump registry.rocket.chat image tag from RocketChat/Rocket.Chat latest release."""
    chart_dir = os.path.join(REPO_ROOT, "charts", "rocketchat")
    values_path = os.path.join(chart_dir, "values.yaml")
    chart_path = os.path.join(chart_dir, "Chart.yaml")

    want = latest_github_release_tag("RocketChat/Rocket.Chat")
    have = current_values_tag(values_path)
    if tags_equivalent(want, have):
        print(f"rocketchat: already at {have}")
        return False

    print(f"rocketchat: {have} -> {want}")
    vyaml = read_file(values_path)
    vyaml, _ = sub_line(
        r'^(\s*tag:\s*")[^"]+(")',
        rf'\g<1>{want}\g<2>',
        vyaml,
    )
    write_file(values_path, vyaml)

    cy = read_file(chart_path)
    cy, _ = sub_line(
        r'^appVersion:\s*".*"$',
        f'appVersion: "{want}"',
        cy,
    )
    cy = bump_patch_chart_version(cy)
    write_file(chart_path, cy)
    return True


def repackage_helm_index() -> None:
    helm_index = os.path.join(REPO_ROOT, "helm-index")
    charts = [
        "migrations-operator",
        "jellyfin",
        "rocketchat",
        "redis",
        "kafka",
    ]
    for name in charts:
        src = os.path.join(REPO_ROOT, "charts", name)
        subprocess.run(
            ["helm", "package", src, "-d", helm_index],
            check=True,
            cwd=REPO_ROOT,
        )
    subprocess.run(
        [
            "helm",
            "repo",
            "index",
            helm_index,
            "--url",
            "https://charts.naphtha.dev/helm-index",
        ],
        check=True,
        cwd=REPO_ROOT,
    )
    shutil.copyfile(
        os.path.join(helm_index, "index.yaml"),
        os.path.join(REPO_ROOT, "index.yaml"),
    )


def main() -> int:
    os.chdir(REPO_ROOT)
    changed = False
    try:
        changed |= update_migrations()
    except Exception as e:
        print(f"migrations-operator: skip ({e})", file=sys.stderr)
    try:
        changed |= update_jellyfin()
    except Exception as e:
        print(f"jellyfin: skip ({e})", file=sys.stderr)
    try:
        changed |= update_rocketchat()
    except Exception as e:
        print(f"rocketchat: skip ({e})", file=sys.stderr)

    if not changed:
        print("No image updates.")
        if os.environ.get("GITHUB_OUTPUT"):
            with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as gh:
                gh.write("changed=false\n")
        return 0

    print("Repackaging helm-index...")
    repackage_helm_index()

    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as gh:
            gh.write("changed=true\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
