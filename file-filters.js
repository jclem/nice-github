/* Shared path filters for hiding tests and generated files. */
(function (global) {
  "use strict";

  const STORAGE_KEYS = {
    hideTests: "niceGithub.hideTests",
    hideGenerated: "niceGithub.hideGenerated",
  };

  const DEFAULTS = {
    hideTests: true,
    hideGenerated: true,
  };

  function normalizePath(path) {
    return String(path || "").replace(/[\u200e\u200f]/g, "").replace(/\\/g, "/").trim();
  }

  function basename(path) {
    const trimmed = normalizePath(path);
    const parts = trimmed.split("/");
    return parts[parts.length - 1] || trimmed;
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

  function hiddenCountLabel(kind, count) {
    const n = Number(count) || 0;
    if (kind === "tests") {
      return n === 1 ? "1 test hidden" : n + " tests hidden";
    }
    return n === 1 ? "1 generated file hidden" : n + " generated files hidden";
  }

  global.NiceGithubFileFilters = {
    STORAGE_KEYS,
    DEFAULTS,
    normalizePath,
    basename,
    isTestPath,
    isGeneratedElement,
    hiddenCountLabel,
  };

  if (typeof module !== "undefined") {
    module.exports = global.NiceGithubFileFilters;
  }
})(typeof globalThis === "undefined" ? this : globalThis);
