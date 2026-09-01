(function () {
  "use strict";

  const PR_DIFF_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:changes|files)\/?$/;

  function getDestination(value) {
    const url = new URL(value);

    if (url.hostname !== "github.com" || !PR_DIFF_PATH.test(url.pathname)) {
      return null;
    }

    // An explicit w=0 is a deliberate opt-out.
    if (url.searchParams.get("w") === "0") {
      return null;
    }

    url.searchParams.set("w", "1");
    return url.href;
  }

  window.addEventListener(
    "click",
    (event) => {
      // Preserve browser behavior for new-tab, modified, and non-primary clicks.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const link = event.target.closest?.("a[href]");
      if (!link) {
        return;
      }

      const destination = getDestination(link.href);
      if (!destination) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      // Loading /changes or /files into GitHub's inner PR turbo-frame nests a
      // full document (double header, stuck spinner, URL bar never advances).
      // A document navigation is less ideal than Turbo, but it lands on one
      // complete files view with w=1 in the address bar.
      window.location.assign(destination);
    },
    true,
  );
})();
