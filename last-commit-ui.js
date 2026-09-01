(function () {
  "use strict";

  const ITEM_ATTR = "data-nice-github-last-commit";
  const helpers = globalThis.NiceGithubLastCommit;
  if (!helpers) {
    return;
  }

  const COMMIT_ICON =
    "M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z";

  const cache = new Map();
  let lastCard = null;
  let mutating = false;

  function itemLabel(node) {
    return (node.textContent || "").replace(/\s+/g, " ").trim();
  }

  function uniqueId(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 9);
  }

  function retargetCloneIds(root) {
    const mapping = new Map();
    for (const el of root.querySelectorAll("[id]")) {
      const next = uniqueId("nice-github");
      mapping.set(el.id, next);
      el.id = next;
    }
    for (const el of [root, ...root.querySelectorAll("[aria-labelledby]")]) {
      const current = el.getAttribute?.("aria-labelledby");
      if (!current) {
        continue;
      }
      el.setAttribute(
        "aria-labelledby",
        current
          .split(/\s+/)
          .map((id) => mapping.get(id) || id)
          .join(" "),
      );
    }
  }

  function setCloneLabel(item, label) {
    const primer = item.querySelector('[data-component="ActionList.Item.Label"]');
    if (primer) {
      primer.textContent = label;
      return;
    }

    const labelled = item.getAttribute("aria-labelledby") || "";
    const labelId = labelled.split(/\s+/)[0];
    const labelNode =
      (labelId && item.querySelector("#" + CSS.escape(labelId))) ||
      item.querySelector("[id$='--label']");
    if (labelNode) {
      labelNode.textContent = label;
      return;
    }

    const spans = item.querySelectorAll("span");
    for (const span of spans) {
      if (itemLabel(span) === "View file") {
        span.textContent = label;
        return;
      }
    }
  }

  function stripKeyboardShortcut(row) {
    for (const el of [row, ...row.querySelectorAll("*")]) {
      el.removeAttribute?.("aria-keyshortcuts");
      el.removeAttribute?.("data-hotkey");
      el.removeAttribute?.("data-keyshortcut");
    }
    for (const hint of row.querySelectorAll("kbd, [data-component='ActionList.Item.TrailingVisual']")) {
      hint.remove();
    }
  }

  function setCommitIcon(row) {
    const path = row.querySelector("svg path");
    if (path) {
      path.setAttribute("d", COMMIT_ICON);
    }
  }

  function findViewFileItem(root) {
    const nodes = (root || document).querySelectorAll(
      'a[href], button, [role="menuitem"]',
    );
    for (const node of nodes) {
      if (itemLabel(node) === "View file") {
        return node;
      }
    }
    return null;
  }

  function menuListFor(item) {
    const row = item.closest("li") || item.parentElement;
    return row?.parentElement || null;
  }

  function isFileKebabMenu(list) {
    if (!list) {
      return false;
    }
    const labels = [];
    for (const node of list.querySelectorAll('a[href], button, [role="menuitem"]')) {
      const label = itemLabel(node);
      if (label) {
        labels.push(label);
      }
    }
    return (
      labels.includes("View file") &&
      (labels.includes("Edit file") || labels.includes("Delete file"))
    );
  }

  function pathFromCard(card) {
    if (!card) {
      return "";
    }

    const code = card.querySelector(
      'h3[class*="DiffFileHeader-module__file-name"] code',
    );
    if (code) {
      return helpers.pathFromHeaderText(code.textContent);
    }

    const labeled = card.querySelector("table[aria-label^='Diff for:']");
    const aria = labeled?.getAttribute("aria-label") || "";
    return helpers.pathFromHeaderText(aria.replace(/^Diff for:\s*/i, ""));
  }

  function pathHashFromCard(card) {
    const id = card?.id || "";
    return id.startsWith("diff-") ? id.slice("diff-".length) : null;
  }

  function hrefFromItem(item) {
    return (
      item.getAttribute?.("href") ||
      item.querySelector?.("a[href]")?.getAttribute("href") ||
      ""
    );
  }

  function headFromScripts() {
    for (const script of document.querySelectorAll(
      'script[type="application/json"]',
    )) {
      try {
        const head = helpers.headFromPayload(JSON.parse(script.textContent));
        if (head) {
          return head;
        }
      } catch {
        // Ignore unrelated JSON blobs GitHub embeds on the page.
      }
    }
    return null;
  }

  function headFromDom(owner, repo) {
    const prefix = "/" + owner + "/" + repo + "/tree/";
    const links = document.querySelectorAll('a[href^="' + prefix + '"]');
    const href = links[links.length - 1]?.getAttribute("href") || "";
    const rest = decodeURIComponent(href.slice(prefix.length).split(/[?#]/)[0] || "");
    if (!rest) {
      return null;
    }
    return { ref: rest.split("/")[0] };
  }

  function contextFromMenu(viewFile) {
    const pr = helpers.parsePrLocation(location.href);
    if (!pr) {
      return null;
    }

    const blob = helpers.parseBlobHref(hrefFromItem(viewFile));
    const path = pathFromCard(lastCard) || blob?.path;
    if (!path) {
      return null;
    }

    const head = headFromScripts() || headFromDom(pr.owner, pr.repo);
    const ref = blob?.ref || head?.sha || head?.ref;
    if (!ref) {
      return null;
    }

    return {
      owner: blob?.owner || pr.owner,
      repo: blob?.repo || pr.repo,
      ref,
      path,
      pathHash: pathHashFromCard(lastCard),
    };
  }

  function cacheKey(ctx) {
    return ctx.owner + "/" + ctx.repo + "@" + ctx.ref + ":" + ctx.path;
  }

  async function fetchLastCommitSha(ctx) {
    try {
      const res = await fetch(helpers.latestCommitUrl(ctx.owner, ctx.repo, ctx.ref, ctx.path), {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (res.ok) {
        const sha = helpers.shaFromLatestCommitPayload(await res.json());
        if (sha) {
          return sha;
        }
      }
    } catch {
      // Fall through to the commits history page.
    }

    try {
      const res = await fetch(
        helpers.commitsHistoryUrl(ctx.owner, ctx.repo, ctx.ref, ctx.path),
        { credentials: "same-origin" },
      );
      if (res.ok) {
        const sha = helpers.shaFromCommitsHtml(await res.text());
        if (sha) {
          return sha;
        }
      }
    } catch {
      // Leave the history-page fallback href in place.
    }

    return null;
  }

  function resolveLastCommit(ctx) {
    const key = cacheKey(ctx);
    if (!cache.has(key)) {
      cache.set(key, fetchLastCommitSha(ctx));
    }
    return cache.get(key);
  }

  function itemLink(row) {
    return row.querySelector("a[href]") || row.querySelector("[role='menuitem']") || row;
  }

  function setItemHref(row, href) {
    const link = itemLink(row);
    if (link?.tagName === "A") {
      link.setAttribute("href", href);
    }
  }

  async function fillCommitHref(row, ctx) {
    const fallback = helpers.commitsHistoryUrl(ctx.owner, ctx.repo, ctx.ref, ctx.path);
    setItemHref(row, fallback);
    const sha = await resolveLastCommit(ctx);
    if (!row.isConnected) {
      return;
    }
    if (sha) {
      setItemHref(row, helpers.commitUrl(ctx.owner, ctx.repo, sha, ctx.pathHash));
    }
  }

  function onLastCommitClick(event, ctx, row) {
    const link = itemLink(row);
    const href = link?.getAttribute?.("href") || "";
    if (/\/commit\/[0-9a-f]{7,40}/i.test(href)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    resolveLastCommit(ctx).then((sha) => {
      const dest = sha
        ? helpers.commitUrl(ctx.owner, ctx.repo, sha, ctx.pathHash)
        : helpers.commitsHistoryUrl(ctx.owner, ctx.repo, ctx.ref, ctx.path);
      window.location.assign(dest);
    });
  }

  function makeLastCommitItem(template, ctx) {
    const row = template.closest("li") || template.parentElement;
    const cloneRow = row.cloneNode(true);
    cloneRow.setAttribute(ITEM_ATTR, "last-commit");
    retargetCloneIds(cloneRow);
    setCloneLabel(cloneRow, "Last commit");
    setCommitIcon(cloneRow);
    stripKeyboardShortcut(cloneRow);

    const fallback = helpers.commitsHistoryUrl(ctx.owner, ctx.repo, ctx.ref, ctx.path);
    setItemHref(cloneRow, fallback);
    cloneRow.addEventListener("click", (event) => {
      onLastCommitClick(event, ctx, cloneRow);
    });
    fillCommitHref(cloneRow, ctx);
    return cloneRow;
  }

  function injectMenuItems() {
    const viewFile = findViewFileItem(document);
    if (!viewFile) {
      return;
    }

    const list = menuListFor(viewFile);
    if (!isFileKebabMenu(list)) {
      return;
    }

    const existing = list.querySelector("[" + ITEM_ATTR + '="last-commit"]');
    if (existing) {
      return;
    }

    const ctx = contextFromMenu(viewFile);
    if (!ctx) {
      return;
    }

    mutating = true;
    const row = viewFile.closest("li") || viewFile.parentElement;
    row.after(makeLastCommitItem(viewFile, ctx));
    mutating = false;
  }

  function boot() {
    document.addEventListener(
      "pointerdown",
      (event) => {
        const card = event.target.closest?.('div[role="region"][id^="diff-"]');
        if (card) {
          lastCard = card;
        }
      },
      true,
    );

    injectMenuItems();
    new MutationObserver(() => {
      if (mutating) {
        return;
      }
      injectMenuItems();
    }).observe(document.documentElement || document, {
      childList: true,
      subtree: true,
    });
  }

  boot();
})();
