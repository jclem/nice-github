/* Helpers for linking a PR file to the commit that last changed it. */
(function (global) {
  "use strict";

  const PR_PATH =
    /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/(?:changes|files|commits|checks|conversation))?\/?$/;

  function parsePrLocation(href) {
    const url = href instanceof URL ? href : new URL(href, "https://github.com");
    if (url.hostname !== "github.com") {
      return null;
    }

    const match = url.pathname.match(PR_PATH);
    if (!match) {
      return null;
    }

    return { owner: match[1], repo: match[2], number: match[3] };
  }

  function normalizePath(path) {
    if (global.NiceGithubFileFilters?.normalizePath) {
      return global.NiceGithubFileFilters.normalizePath(path);
    }

    return String(path || "")
      .replace(/[\u200e\u200f]/g, "")
      .replace(/\\/g, "/")
      .trim();
  }

  function pathFromHeaderText(text) {
    const normalized = normalizePath(text);
    const parts = normalized.split(/\s*(?:→|=>)\s*/);
    return parts[parts.length - 1] || normalized;
  }

  function commitUrl(owner, repo, sha, pathHash) {
    const url = "https://github.com/" + owner + "/" + repo + "/commit/" + sha;
    return pathHash ? url + "#diff-" + pathHash : url;
  }

  function encodeRef(ref) {
    return encodeURIComponent(ref);
  }

  function encodePath(path) {
    return String(path)
      .split("/")
      .filter((part) => part.length > 0)
      .map(encodeURIComponent)
      .join("/");
  }

  function latestCommitUrl(owner, repo, ref, path) {
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

  function commitsHistoryUrl(owner, repo, ref, path) {
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

  function parseBlobHref(href) {
    if (!href) {
      return null;
    }

    let url;
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

    const rest = match[3];
    const shaMatch = rest.match(/^([0-9a-f]{40})\/(.+)$/i);
    if (shaMatch) {
      return {
        owner: match[1],
        repo: match[2],
        ref: shaMatch[1],
        path: shaMatch[2]
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
      owner: match[1],
      repo: match[2],
      ref: decodeURIComponent(rest.slice(0, slash)),
      path: rest
        .slice(slash + 1)
        .split("/")
        .map(decodeURIComponent)
        .join("/"),
    };
  }

  function isSha(value) {
    return typeof value === "string" && /^[0-9a-f]{7,40}$/i.test(value);
  }

  function shaFromLatestCommitPayload(data) {
    if (!data || typeof data !== "object") {
      return null;
    }

    const sha = data.oid || data.sha;
    return isSha(sha) ? sha : null;
  }

  function shaFromCommitsApi(data) {
    const first = Array.isArray(data) ? data[0] : data;
    const sha = first?.sha || first?.oid || first?.commit?.oid;
    return isSha(sha) ? sha : null;
  }

  function shaFromCommitsHtml(html) {
    const match = String(html).match(/\/commit\/([0-9a-f]{40})/i);
    return match ? match[1] : null;
  }

  function walkJson(value, visit, depth) {
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

  function headFromPayload(data) {
    let found = null;
    walkJson(
      data,
      (obj) => {
        if (found) {
          return;
        }

        const pageSha = obj.headOid || obj.headSha;
        if (isSha(pageSha) && pageSha.length === 40) {
          found = {
            sha: pageSha,
            ref: typeof obj.headRefName === "string" ? obj.headRefName : null,
          };
          return;
        }

        if (obj.head && typeof obj.head === "object") {
          const sha = obj.head.sha || obj.head.oid;
          if (isSha(sha) && sha.length === 40) {
            found = {
              sha,
              ref: typeof obj.head.ref === "string" ? obj.head.ref : null,
            };
          }
        }
      },
      0,
    );
    return found;
  }

  global.NiceGithubLastCommit = {
    parsePrLocation,
    normalizePath,
    pathFromHeaderText,
    commitUrl,
    latestCommitUrl,
    commitsHistoryUrl,
    parseBlobHref,
    shaFromLatestCommitPayload,
    shaFromCommitsApi,
    shaFromCommitsHtml,
    headFromPayload,
  };

  if (typeof module !== "undefined") {
    module.exports = global.NiceGithubLastCommit;
  }
})(typeof globalThis === "undefined" ? this : globalThis);
