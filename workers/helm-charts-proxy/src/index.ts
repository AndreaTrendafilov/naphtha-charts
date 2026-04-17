/**
 * Serves Helm index + .tgz from GitHub raw .../main/helm-index/<file>.
 *
 * URL shapes (this Worker should only be bound to charts.naphtha.dev and *.workers.dev):
 * - https://charts.naphtha.dev/index.yaml  (what `helm repo add https://charts.naphtha.dev` uses)
 * - https://charts.naphtha.dev/*.tgz
 * - https://<worker>.workers.dev/charts/index.yaml  (path style for quick tests)
 */

export interface Env {
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const filename = resolveFilename(url);
    if (!filename) {
      return new Response("Not Found", { status: 404 });
    }

    const rawBase = `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH}/helm-index`;
    const upstreamUrl = `${rawBase}/${filename}`;

    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: {
        "User-Agent": "naphtha-helm-charts-proxy/1.0",
      },
      cf: {
        cacheTtl: filename === "index.yaml" ? 60 : 600,
        cacheEverything: true,
      },
    });

    if (upstream.status === 404) {
      return new Response("Not Found", { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", contentType(filename));
    headers.set(
      "Cache-Control",
      filename === "index.yaml"
        ? "public, max-age=60"
        : "public, max-age=3600, immutable",
    );

    const etag = upstream.headers.get("etag");
    if (etag) {
      headers.set("etag", etag);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};

function contentType(filename: string): string {
  if (filename.endsWith(".tgz")) {
    return "application/gzip";
  }
  if (filename.endsWith(".yaml") || filename.endsWith(".yml")) {
    return "text/yaml; charset=utf-8";
  }
  return "application/octet-stream";
}

/**
 * 1) /charts/<file> — works on *.workers.dev and apex routes
 * 2) /, /index.yaml, /<name>.tgz — Helm repo URL is scheme://host with no path,
 *    so clients request /index.yaml at the Worker hostname
 */
function resolveFilename(url: URL): string | null {
  const path = url.pathname;

  if (path.startsWith("/charts/")) {
    const fn = path.slice("/charts/".length);
    if (
      !fn ||
      fn.includes("/") ||
      fn.includes("..") ||
      fn.startsWith(".")
    ) {
      return null;
    }
    return fn;
  }

  if (path === "/" || path === "") {
    return "index.yaml";
  }

  const m = /^\/([^/]+)$/.exec(path);
  if (!m) {
    return null;
  }
  const name = m[1];
  if (name.includes("..") || name.startsWith(".")) {
    return null;
  }
  if (
    name === "index.yaml" ||
    name.endsWith(".yaml") ||
    name.endsWith(".yml") ||
    name.endsWith(".tgz")
  ) {
    return name;
  }
  return null;
}
