/**
 * Serves https://naphtha.dev/charts/<file> from GitHub raw:
 * .../main/helm-index/<file>
 *
 * After you push updated helm-index/ to main, Helm clients see changes within cache TTL.
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
    const prefix = "/charts/";
    if (!url.pathname.startsWith(prefix)) {
      return new Response("Not Found", { status: 404 });
    }

    const filename = url.pathname.slice(prefix.length);
    if (
      !filename ||
      filename.includes("/") ||
      filename.includes("..") ||
      filename.startsWith(".")
    ) {
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
