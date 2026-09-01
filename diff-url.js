/* Shared URL policy for the extension service worker and content script. */
(function (global) {
  "use strict";

  // GitHub renamed the PR diff route from /files to /changes. Keep both so
  // older links and the current UI get the same behavior.
  const PR_FILES_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:changes|files)\/?$/;

  function isPullRequestFilesUrl(value) {
    const url = value instanceof URL ? value : new URL(value);
    return url.hostname === "github.com" && PR_FILES_PATH.test(url.pathname);
  }

  function withWhitespaceHidden(value) {
    const url = value instanceof URL ? new URL(value.href) : new URL(value);

    // An explicit w=0 is a deliberate request to show whitespace. Only supply
    // GitHub's hide-whitespace preference when the URL has no w value at all.
    if (!isPullRequestFilesUrl(url) || url.searchParams.has("w")) {
      return null;
    }

    url.searchParams.set("w", "1");
    return url.href;
  }

  global.NiceGithubDiffUrl = { isPullRequestFilesUrl, withWhitespaceHidden };

  if (typeof module !== "undefined") {
    module.exports = global.NiceGithubDiffUrl;
  }
})(typeof globalThis === "undefined" ? this : globalThis);
