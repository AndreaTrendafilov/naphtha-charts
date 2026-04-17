/**
 * Serves Helm index + .tgz from GitHub.
 *
 * Public repo: uses raw.githubusercontent.com (no token).
 * Private repo: set GITHUB_TOKEN (Worker secret) — uses GitHub Contents API with
 * Accept: application/vnd.github.raw (Bearer auth).
 *
 * URL shapes:
 * - https://charts.naphtha.dev/index.yaml
 * - https://charts.naphtha.dev/helm-index/<chart>.tgz
 * - https://charts.naphtha.dev/<chart>.tgz  (same files under helm-index/)
 */

export interface Env {
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  /** Optional. Required when the repo is private. Create a fine-grained PAT with Contents: Read. */
  GITHUB_TOKEN?: string;
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

    const repoPath = resolveRepoPath(new URL(request.url));
    if (!repoPath) {
      return new Response("Not Found", { status: 404 });
    }

    const filename = repoPath.split("/").pop() ?? repoPath;
    const upstream = await fetchFromGitHub(env, repoPath, request.method);

    if (upstream.status === 404) {
      return new Response("Not Found", { status: 404 });
    }

    if (!upstream.ok && upstream.status !== 304) {
      const text = await upstream.text();
      return new Response(text, { status: upstream.status });
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

async function fetchFromGitHub(
  env: Env,
  repoPath: string,
  method: string,
): Promise<Response> {
  const token = env.GITHUB_TOKEN?.trim();
  const useApi = Boolean(token);

  const pathEncoded = repoPath
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  const url = useApi
    ? `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${pathEncoded}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`
    : `https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${env.GITHUB_BRANCH}/${repoPath}`;

  const headers: Record<string, string> = {
    "User-Agent": "naphtha-helm-charts-proxy/1.0",
  };

  if (useApi) {
    headers.Authorization = `Bearer ${token}`;
    headers.Accept = "application/vnd.github.raw";
    headers["X-GitHub-Api-Version"] = "2022-11-28";
  }

  const filename = repoPath.split("/").pop() ?? "";

  // Avoid caching authenticated fetches at the edge (shared cache).
  const cfOpts = useApi
    ? { cacheTtl: 0, cacheEverything: false as const }
    : {
        cacheTtl: filename === "index.yaml" ? 60 : 600,
        cacheEverything: true as const,
      };

  return fetch(url, {
    method,
    headers,
    cf: cfOpts,
  });
}

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
 * Map request path → path in repo (relative to root).
 */
function resolveRepoPath(url: URL): string | null {
  const path = url.pathname;

  if (path.startsWith("/helm-index/")) {
    const rest = path.slice("/helm-index/".length);
    if (!rest || rest.includes("..") || rest.includes("/")) {
      return null;
    }
    if (!isSafeBasename(rest)) {
      return null;
    }
    return `helm-index/${rest}`;
  }

  if (path.startsWith("/charts/")) {
    const rest = path.slice("/charts/".length);
    if (!rest || rest.includes("..") || rest.includes("/")) {
      return null;
    }
    if (!isSafeBasename(rest)) {
      return null;
    }
    return `helm-index/${rest}`;
  }

  if (path === "/" || path === "") {
    return "index.yaml";
  }

  const m = /^\/([^/]+)$/.exec(path);
  if (!m) {
    return null;
  }

  const name = m[1];
  if (!isSafeBasename(name)) {
    return null;
  }

  if (name === "index.yaml" || name.endsWith(".yaml") || name.endsWith(".yml")) {
    return name;
  }

  if (name.endsWith(".tgz")) {
    return `helm-index/${name}`;
  }

  return null;
}

function isSafeBasename(name: string): boolean {
  if (!name || name.includes("..") || name.startsWith(".")) {
    return false;
  }
  return true;
}
