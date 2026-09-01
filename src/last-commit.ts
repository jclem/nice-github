export { normalizePath, pathFromHeaderText } from "./file-filters";

const PR_PATH =
  /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/(?:changes|files|commits|checks|conversation))?\/?$/;

export type PrLocation = {
  owner: string;
  repo: string;
  number: string;
};

export type BlobHref = {
  owner: string;
  repo: string;
  ref: string;
  path: string;
};

export type HeadInfo = {
  sha: string;
  ref: string | null;
};

export function parsePrLocation(href: string | URL): PrLocation | null {
  const url = href instanceof URL ? href : new URL(href, "https://github.com");
  if (url.hostname !== "github.com") {
    return null;
  }

  const match = url.pathname.match(PR_PATH);
  if (!match) {
    return null;
  }

  return { owner: match[1]!, repo: match[2]!, number: match[3]! };
}

export function commitUrl(owner: string, repo: string, sha: string, pathHash?: string | null): string {
  const url = "https://github.com/" + owner + "/" + repo + "/commit/" + sha;
  return pathHash ? url + "#diff-" + pathHash : url;
}

function encodeRef(ref: string): string {
  return encodeURIComponent(ref);
}

function encodePath(path: string): string {
  return String(path)
    .split("/")
    .filter((part) => part.length > 0)
    .map(encodeURIComponent)
    .join("/");
}

export function latestCommitUrl(owner: string, repo: string, ref: string, path: string): string {
  return (
    "https://github.com/" +
    owner +
    "/" +
    repo +
    "/latest-commit/" +
    encodeRef(ref) +
    "/" +
    encodePath(path)
  );
}

export function blobPermalink(owner: string, repo: string, ref: string, path: string): string {
  return (
    "https://github.com/" +
    owner +
    "/" +
    repo +
    "/blob/" +
    encodeRef(ref) +
    "/" +
    encodePath(path)
  );
}

export function absoluteHref(href: string | null | undefined): string | null {
  if (!href) {
    return null;
  }
  try {
    const url = new URL(href, "https://github.com");
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

export function commitsHistoryUrl(owner: string, repo: string, ref: string, path: string): string {
  return (
    "https://github.com/" +
    owner +
    "/" +
    repo +
    "/commits/" +
    encodeRef(ref) +
    "/" +
    encodePath(path)
  );
}

export function parseBlobHref(href: string | null | undefined): BlobHref | null {
  if (!href) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(href, "https://github.com");
  } catch {
    return null;
  }

  if (url.hostname !== "github.com") {
    return null;
  }

  const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (!match) {
    return null;
  }

  const rest = match[3]!;
  const shaMatch = rest.match(/^([0-9a-f]{40})\/(.+)$/i);
  if (shaMatch) {
    return {
      owner: match[1]!,
      repo: match[2]!,
      ref: shaMatch[1]!,
      path: shaMatch[2]!
        .split("/")
        .map(decodeURIComponent)
        .join("/"),
    };
  }

  const slash = rest.indexOf("/");
  if (slash === -1) {
    return null;
  }

  return {
    owner: match[1]!,
    repo: match[2]!,
    ref: decodeURIComponent(rest.slice(0, slash)),
    path: rest
      .slice(slash + 1)
      .split("/")
      .map(decodeURIComponent)
      .join("/"),
  };
}

export function isSha(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{7,40}$/i.test(value);
}

export function shaFromLatestCommitPayload(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const rec = data as Record<string, unknown>;
  const sha = rec.oid || rec.sha;
  return isSha(sha) ? sha : null;
}

export function shaFromCommitsApi(data: unknown): string | null {
  const first = Array.isArray(data) ? data[0] : data;
  if (!first || typeof first !== "object") {
    return null;
  }
  const rec = first as Record<string, unknown>;
  const commit = rec.commit && typeof rec.commit === "object" ? (rec.commit as Record<string, unknown>) : null;
  const sha = rec.sha || rec.oid || commit?.oid;
  return isSha(sha) ? sha : null;
}

export function shaFromCommitsHtml(html: unknown): string | null {
  const match = String(html).match(/\/commit\/([0-9a-f]{40})/i);
  return match ? match[1]! : null;
}

function walkJson(value: unknown, visit: (obj: object) => void, depth: number): void {
  if (!value || typeof value !== "object" || depth > 14) {
    return;
  }

  visit(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      walkJson(item, visit, depth + 1);
    }
    return;
  }

  for (const child of Object.values(value)) {
    walkJson(child, visit, depth + 1);
  }
}

export function headFromPayload(data: unknown): HeadInfo | null {
  let found: HeadInfo | null = null;
  walkJson(
    data,
    (obj) => {
      if (found) {
        return;
      }

      const rec = obj as Record<string, unknown>;
      const pageSha = rec.headOid || rec.headSha;
      if (isSha(pageSha) && pageSha.length === 40) {
        found = {
          sha: pageSha,
          ref: typeof rec.headRefName === "string" ? rec.headRefName : null,
        };
        return;
      }

      if (rec.head && typeof rec.head === "object") {
        const head = rec.head as Record<string, unknown>;
        const sha = head.sha || head.oid;
        if (isSha(sha) && sha.length === 40) {
          found = {
            sha,
            ref: typeof head.ref === "string" ? head.ref : null,
          };
        }
      }
    },
    0,
  );
  return found;
}
