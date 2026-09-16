export const STORAGE_KEYS = { repoSettings: "niceGithub.repoSettings" } as const;

export type RepoSettings = {
  hideTests: boolean;
  hideGenerated: boolean;
  hideDeleted: boolean;
  hideRenameOnly: boolean;
  hideGlobs: string[];
};

export const DEFAULTS: RepoSettings = {
  hideTests: false,
  hideGenerated: false,
  hideDeleted: false,
  hideRenameOnly: false,
  hideGlobs: [],
};

export function normalizePath(path: unknown): string {
  return String(path || "").replace(/[\u200e\u200f]/g, "").replace(/\\/g, "/").trim();
}

export function basename(path: unknown): string {
  const trimmed = normalizePath(path);
  const parts = trimmed.split("/");
  return parts[parts.length - 1] || trimmed;
}

export function pathFromHeaderText(text: unknown): string {
  const normalized = normalizePath(text);
  const parts = normalized.split(/\s*(?:→|=>)\s*/);
  return parts[parts.length - 1] || normalized;
}

export function repoFromUrl(href: string | URL): string | null {
  const url = href instanceof URL ? href : new URL(href, "https://github.com");
  if (url.hostname !== "github.com") {
    return null;
  }
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);
  return match ? match[1] + "/" + match[2] : null;
}

// "*.test.*" (foo.test.ts) and "_test.*" (foo_test.go, _test.py).
export function isTestPath(path: unknown): boolean {
  const name = basename(path);
  return /\.test\./.test(name) || /_test\./.test(name);
}

export function isGeneratedElement(element: Element | null | undefined): boolean {
  if (!element || element.nodeType !== 1) {
    return false;
  }

  if (element.getAttribute?.("data-generated") === "true") {
    return true;
  }
  if (element.getAttribute?.("data-file-generated") === "true") {
    return true;
  }

  return Boolean(
    element.querySelector?.(
      ":scope > [data-generated='true'], :scope > [data-file-generated='true']",
    ),
  );
}

export function parseGlobs(text: unknown): string[] {
  return String(text || "")
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function escapeRegex(value: unknown): string {
  return String(value).replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

export function globToRegExp(glob: string): RegExp {
  const source = normalizePath(glob);
  let pattern = "^";
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === "*" && source[i + 1] === "*") {
      if (source[i + 2] === "/") {
        pattern += "(?:.*/)?";
        i += 2;
      } else {
        pattern += ".*";
        i += 1;
      }
    } else if (char === "*") {
      pattern += "[^/]*";
    } else if (char === "?") {
      pattern += "[^/]";
    } else {
      pattern += escapeRegex(char);
    }
  }
  pattern += "$";
  return new RegExp(pattern);
}

export function pathMatchesGlob(path: unknown, glob: unknown): boolean {
  const filePath = normalizePath(path);
  const pattern = normalizePath(glob);
  if (!filePath || !pattern) {
    return false;
  }
  if (!pattern.includes("/")) {
    return globToRegExp("**/" + pattern).test(filePath) || globToRegExp(pattern).test(basename(filePath));
  }
  return globToRegExp(pattern).test(filePath);
}

export function pathMatchesAnyGlob(path: unknown, globs: string[] | null | undefined): boolean {
  return (globs || []).some((glob) => pathMatchesGlob(path, glob));
}

export function matchingGlobs(path: unknown, globs: string[] | null | undefined): string[] {
  return (globs || []).filter((glob) => pathMatchesGlob(path, glob));
}

export function allTreeLeavesHidden(hiddenStates: readonly boolean[]): boolean {
  return hiddenStates.length > 0 && hiddenStates.every(Boolean);
}

export function hiddenCountLabel(kind: string, count: unknown, glob?: string): string {
  const n = Number(count) || 0;
  if (kind === "tests") {
    return n === 1 ? "1 test hidden" : n + " tests hidden";
  }
  if (kind === "generated") {
    return n === 1 ? "1 generated file hidden" : n + " generated files hidden";
  }
  if (kind === "deleted") {
    return n === 1 ? "1 deleted file hidden" : n + " deleted files hidden";
  }
  if (kind === "renamed") {
    return n === 1 ? "1 rename-only file hidden" : n + " rename-only files hidden";
  }
  if (kind === "glob") {
    const label = glob || "glob";
    return n === 1 ? "1 " + label + " hidden" : n + " " + label + " hidden";
  }
  return n + " hidden";
}

export function normalizeRepoSettings(value?: Partial<RepoSettings> | null): RepoSettings {
  const globs = Array.isArray(value?.hideGlobs) ? value.hideGlobs.map(normalizePath).filter(Boolean) : [];
  return {
    hideTests: value?.hideTests === true,
    hideGenerated: value?.hideGenerated === true,
    hideDeleted: value?.hideDeleted === true,
    hideRenameOnly: value?.hideRenameOnly === true,
    hideGlobs: globs,
  };
}

export function isDefaultRepoSettings(settings?: Partial<RepoSettings> | null): boolean {
  const normalized = normalizeRepoSettings(settings);
  return (
    !normalized.hideTests &&
    !normalized.hideGenerated &&
    !normalized.hideDeleted &&
    !normalized.hideRenameOnly &&
    normalized.hideGlobs.length === 0
  );
}
