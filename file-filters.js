/* Shared path filters for hiding tests, generated, deleted, and glob matches. */
(function (global) {
  "use strict";

  const STORAGE_KEYS = {
    repoSettings: "niceGithub.repoSettings",
  };

  const DEFAULTS = {
    hideTests: false,
    hideGenerated: false,
    hideDeleted: false,
    hideRenameOnly: false,
    hideGlobs: [],
  };

  function normalizePath(path) {
    return String(path || "").replace(/[\u200e\u200f]/g, "").replace(/\\/g, "/").trim();
  }

  function basename(path) {
    const trimmed = normalizePath(path);
    const parts = trimmed.split("/");
    return parts[parts.length - 1] || trimmed;
  }

  function pathFromHeaderText(text) {
    const normalized = normalizePath(text);
    const parts = normalized.split(/\s*(?:→|=>)\s*/);
    return parts[parts.length - 1] || normalized;
  }

  function repoFromUrl(href) {
    const url = href instanceof URL ? href : new URL(href, "https://github.com");
    if (url.hostname !== "github.com") {
      return null;
    }
    const match = url.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);
    return match ? match[1] + "/" + match[2] : null;
  }

  // "*.test.*" (foo.test.ts) and "_test.*" (foo_test.go, _test.py).
  function isTestPath(path) {
    const name = basename(path);
    return /\.test\./.test(name) || /_test\./.test(name);
  }

  function isGeneratedElement(element) {
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

  function parseGlobs(text) {
    return String(text || "")
      .split(/[\n,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function escapeRegex(value) {
    return String(value).replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }

  function globToRegExp(glob) {
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

  function pathMatchesGlob(path, glob) {
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

  function pathMatchesAnyGlob(path, globs) {
    return (globs || []).some((glob) => pathMatchesGlob(path, glob));
  }

  function matchingGlobs(path, globs) {
    return (globs || []).filter((glob) => pathMatchesGlob(path, glob));
  }

  function hiddenCountLabel(kind, count, glob) {
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

  function normalizeRepoSettings(value) {
    const globs = Array.isArray(value?.hideGlobs) ? value.hideGlobs.map(normalizePath).filter(Boolean) : [];
    return {
      hideTests: value?.hideTests === true,
      hideGenerated: value?.hideGenerated === true,
      hideDeleted: value?.hideDeleted === true,
      hideRenameOnly: value?.hideRenameOnly === true,
      hideGlobs: globs,
    };
  }

  function isDefaultRepoSettings(settings) {
    const normalized = normalizeRepoSettings(settings);
    return (
      !normalized.hideTests &&
      !normalized.hideGenerated &&
      !normalized.hideDeleted &&
      !normalized.hideRenameOnly &&
      normalized.hideGlobs.length === 0
    );
  }

  global.NiceGithubFileFilters = {
    STORAGE_KEYS,
    DEFAULTS,
    normalizePath,
    basename,
    pathFromHeaderText,
    repoFromUrl,
    isTestPath,
    isGeneratedElement,
    parseGlobs,
    pathMatchesGlob,
    pathMatchesAnyGlob,
    matchingGlobs,
    hiddenCountLabel,
    normalizeRepoSettings,
    isDefaultRepoSettings,
  };

  if (typeof module !== "undefined") {
    module.exports = global.NiceGithubFileFilters;
  }
})(typeof globalThis === "undefined" ? this : globalThis);
