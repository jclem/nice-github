(function () {
  "use strict";

  function rewriteLink(link) {
    const redirectedUrl = NiceGithubDiffUrl.withWhitespaceHidden(link.href);

    if (redirectedUrl) {
      link.href = redirectedUrl;
    }
  }

  function rewriteDiffLinks(root = document) {
    root.querySelectorAll?.("a[href]").forEach(rewriteLink);
  }

  function enforceWhitespaceHidden() {
    const redirectedUrl = NiceGithubDiffUrl.withWhitespaceHidden(window.location.href);

    if (redirectedUrl) {
      // replace() avoids adding the unfiltered diff to the Back-button history.
      window.location.replace(redirectedUrl);
    }
  }

  // This is the earliest guard for direct loads.
  enforceWhitespaceHidden();

  // GitHub normally uses Turbo to transition between PR tabs. Point its link at
  // the final URL before the click, rather than redirecting after navigation.
  rewriteDiffLinks();
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest?.("a[href]");
      if (link) {
        rewriteLink(link);
      }
    },
    true,
  );

  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches?.("a[href]")) {
            rewriteLink(node);
          }
          rewriteDiffLinks(node);
        }
      }
    }
  }).observe(document.documentElement || document, { childList: true, subtree: true });

  document.addEventListener("turbo:load", () => {
    enforceWhitespaceHidden();
    rewriteDiffLinks();
  });
  document.addEventListener("pjax:end", () => {
    enforceWhitespaceHidden();
    rewriteDiffLinks();
  });
})();
