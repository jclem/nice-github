var NiceGithubTurboNavigation = (function(exports) {
  "use strict";
  const PR_DIFF_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:changes|files)\/?$/;
  function getDestination(value) {
    const url = new URL(value);
    if (url.hostname !== "github.com" || !PR_DIFF_PATH.test(url.pathname)) {
      return null;
    }
    if (url.searchParams.get("w") === "0") {
      return null;
    }
    url.searchParams.set("w", "1");
    return url.href;
  }
  function handleDiffClick(event, assignHref = (href) => {
    window.location.assign(href);
  }) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const target = event.target;
    const link = target?.closest?.("a[href]");
    if (!link) {
      return;
    }
    const destination = getDestination(link.href);
    if (!destination) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    assignHref(destination);
  }
  function bootTurboNavigation() {
    window.addEventListener("click", (event) => handleDiffClick(event), true);
  }
  if (typeof window !== "undefined") {
    bootTurboNavigation();
  }
  exports.bootTurboNavigation = bootTurboNavigation;
  exports.getDestination = getDestination;
  exports.handleDiffClick = handleDiffClick;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
})({});
