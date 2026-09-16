const PR_FILES_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:changes|files)\/?$/;

function parseUrl(value: string | URL): URL | null {
  try {
    return new URL(value instanceof URL ? value.href : value);
  } catch {
    return null;
  }
}

export function isPullRequestFilesUrl(value: string | URL): boolean {
  const url = parseUrl(value);
  return url !== null && url.hostname === "github.com" && PR_FILES_PATH.test(url.pathname);
}

export function withWhitespaceHidden(value: string | URL): string | null {
  const url = parseUrl(value);
  if (url === null || !isPullRequestFilesUrl(url) || url.searchParams.has("w")) {
    return null;
  }
  url.searchParams.set("w", "1");
  return url.href;
}
