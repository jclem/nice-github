const PR_FILES_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:changes|files)\/?$/;

export function isPullRequestFilesUrl(value: string | URL): boolean {
  const url = value instanceof URL ? value : new URL(value);
  return url.hostname === "github.com" && PR_FILES_PATH.test(url.pathname);
}

export function withWhitespaceHidden(value: string | URL): string | null {
  const url = value instanceof URL ? new URL(value.href) : new URL(value);
  if (!isPullRequestFilesUrl(url) || url.searchParams.has("w")) {
    return null;
  }
  url.searchParams.set("w", "1");
  return url.href;
}
