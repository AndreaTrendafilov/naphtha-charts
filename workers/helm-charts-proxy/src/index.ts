/**
 * Serves Helm index + .tgz from GitHub raw .../main/helm-index/<file>.
 *
 * Two URL shapes (see CHARTS_HOSTNAME in wrangler.toml):
 * - https://charts.example.com/index.yaml  (recommended if apex is Cloudflare Pages)
 * - https://example.com/charts/index.yaml  (only if a Worker route wins over Pages)
 */

export interface Env {
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  /** e.g. charts.naphtha.dev — if set, / and /index.yaml / *.tgz are served here */
  CHARTS_HOSTNAME: string;
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
    const filename = resolveFilename(url, env.CHARTS_HOSTNAME);
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
 * Dedicated charts host (bypasses Pages on apex): charts.naphtha.dev/index.yaml
 * Path host: naphtha.dev/charts/index.yaml (needs Worker route above Pages)
 */
function resolveFilename(url: URL, chartsHostname: string): string | null {
  const host = url.hostname.toLowerCase();
  const path = url.pathname;

  const dedicated =
    chartsHostname && host === chartsHostname.trim().toLowerCase();
  if (dedicated) {
    if (path === "/" || path === "") {
      return "index.yaml";
    }
    const name = path.startsWith("/") ? path.slice(1) : path;
    if (
      !name ||
      name.includes("/") ||
      name.includes("..") ||
      name.startsWith(".")
    ) {
      return null;
    }
    return name;
  }

  const prefix = "/charts/";
  if (!path.startsWith(prefix)) {
    return null;
  }
  const fn = path.slice(prefix.length);
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
