var NiceGithubContent = (function(exports) {
  "use strict";
  const CHROME_HIDE_STYLE_ID = "nice-github-chrome-hide";
  const HEADER = ':is(header.GlobalNav, header.AppHeader, header[role="banner"])';
  const CHROME_HIDE_CSS = [
    /* Copilot link + caret (hashed BEM suffix omitted). */
    '[class*="CopilotItems-module__Wrapper"]',
    ".AppHeader-CopilotChat",
    `${HEADER} a[href="/copilot"]`,
    'button[aria-label^="Open Copilot"]',
    'button[class*="CopilotItems-module__CopilotMenu"]',
    "button:has(svg.octicon-copilot)",
    /* Agents (cloud / lightning) */
    `${HEADER} [class*="CopilotItems-module__Wrapper"]:has(#global-copilot-agent-button)`,
    `${HEADER} #global-copilot-agent-button`,
    `${HEADER} button[aria-label="Open agents panel"]`,
    /* Create new + */
    `${HEADER} button[class*="GlobalCreateMenu-module__actionMenuButton"]`,
    `${HEADER} [class*="GlobalCreateMenu-module__responsiveCreateMenu"]`,
    `${HEADER} #global-create-menu-anchor`,
    `${HEADER} [aria-label^="Create new"]`,
    /* Global Issues / Pull requests / Repositories */
    `${HEADER} .hide-sm.hide-md:has(a[href="/repos"])`,
    `${HEADER} a[href="/issues"]`,
    `${HEADER} a[href="/pulls"]`,
    `${HEADER} a[href="/repos"]`,
    `${HEADER} a[href$="?tab=repositories"]`,
    /* Repo UnderlineNav Agents tab — not Issues / Pull requests */
    'nav[aria-label="Repository"] li:has(> a[data-tab-item="agents"])',
    'nav[aria-label="Repository"] li:has(> a[data-react-nav="repo-agents"])',
    'nav[aria-label="Repository"] li:has(svg.octicon-agent)'
  ].map((selector) => selector + "{display:none !important;}").join("") + ".nice-github-merge-summary-container{align-self:center !important;}";
  function bootChromeHide() {
    if (document.getElementById(CHROME_HIDE_STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = CHROME_HIDE_STYLE_ID;
    style.textContent = CHROME_HIDE_CSS;
    (document.head || document.documentElement).appendChild(style);
  }
  const PR_FILES_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+\/(?:changes|files)\/?$/;
  function parseUrl(value) {
    try {
      return new URL(value instanceof URL ? value.href : value);
    } catch {
      return null;
    }
  }
  function isPullRequestFilesUrl(value) {
    const url = parseUrl(value);
    return url !== null && url.hostname === "github.com" && PR_FILES_PATH.test(url.pathname);
  }
  function withWhitespaceHidden(value) {
    const url = parseUrl(value);
    if (url === null || !isPullRequestFilesUrl(url) || url.searchParams.has("w")) {
      return null;
    }
    url.searchParams.set("w", "1");
    return url.href;
  }
  const STORAGE_KEYS = { repoSettings: "niceGithub.repoSettings" };
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
  function isTestPath(path) {
    const name = basename(path);
    return /\.test\./.test(name) || /_test\./.test(name);
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
  function allTreeLeavesHidden(hiddenStates) {
    return hiddenStates.length > 0 && hiddenStates.every(Boolean);
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
      hideGlobs: globs
    };
  }
  function isDefaultRepoSettings(settings) {
    const normalized = normalizeRepoSettings(settings);
    return !normalized.hideTests && !normalized.hideGenerated && !normalized.hideDeleted && !normalized.hideRenameOnly && normalized.hideGlobs.length === 0;
  }
  const HIDDEN_CLASS = "nice-github-hidden-file";
  const ITEM_ATTR$1 = "data-nice-github-filter";
  const SUMMARY_ID = "nice-github-hidden-summary";
  const state = normalizeRepoSettings();
  let mutating$2 = false;
  let lastCounts = "";
  let lastRepo = null;
  function injectStyle$1() {
    if (document.getElementById("nice-github-file-filter-style")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "nice-github-file-filter-style";
    style.textContent = [
      "." + HIDDEN_CLASS + "{display:none !important;}",
      "[" + ITEM_ATTR$1 + '] [aria-checked="false"] [data-component="ActionList.Selection"],',
      "[" + ITEM_ATTR$1 + '][aria-checked="false"] [data-component="ActionList.Selection"]{',
      "visibility:hidden;",
      "}",
      "#nice-github-hidden-summary{",
      "display:flex;",
      "flex-wrap:wrap;",
      "gap:6px;",
      "padding:8px 12px 4px;",
      "}",
      ".nice-github-hidden-chip{",
      "display:inline-flex;",
      "align-items:center;",
      "gap:4px;",
      "font-size:12px;",
      "line-height:1.2;",
      "color:var(--fgColor-muted,#59636e);",
      "background:var(--bgColor-muted,#f6f8fa);",
      "border:1px solid var(--borderColor-muted,#d1d9e0);",
      "border-radius:999px;",
      "padding:2px 6px 2px 8px;",
      "}",
      ".nice-github-hidden-chip button{",
      "border:0;",
      "background:transparent;",
      "color:inherit;",
      "cursor:pointer;",
      "padding:0 2px;",
      "font-size:14px;",
      "line-height:1;",
      "}",
      ".nice-github-glob-row{",
      "display:flex;",
      "align-items:center;",
      "gap:6px;",
      "width:100%;",
      "}",
      ".nice-github-glob-input{",
      "flex:1;",
      "min-width:8em;",
      "margin:0;",
      "border:1px solid var(--borderColor-muted,#d1d9e0);",
      "border-radius:6px;",
      "padding:2px 6px;",
      "font:inherit;",
      "font-size:12px;",
      "background:var(--bgColor-default,#fff);",
      "color:inherit;",
      "}",
      ".nice-github-glob-remove{",
      "border:0;",
      "background:transparent;",
      "color:var(--fgColor-muted,#59636e);",
      "cursor:pointer;",
      "padding:4px 8px;",
      "min-width:24px;",
      "min-height:24px;",
      "font-size:14px;",
      "line-height:1;",
      "}"
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }
  function currentRepo() {
    return repoFromUrl(location.href);
  }
  function applyRepoSettings(value) {
    const next = normalizeRepoSettings(value);
    state.hideTests = next.hideTests;
    state.hideGenerated = next.hideGenerated;
    state.hideDeleted = next.hideDeleted;
    state.hideRenameOnly = next.hideRenameOnly;
    state.hideGlobs = next.hideGlobs.slice();
  }
  function loadSettings(done) {
    lastRepo = currentRepo();
    applyRepoSettings();
    const repo = lastRepo;
    if (typeof chrome === "undefined" || !chrome.storage?.sync || !repo) {
      done();
      return;
    }
    chrome.storage.sync.get([STORAGE_KEYS.repoSettings], (stored) => {
      const all = stored[STORAGE_KEYS.repoSettings] || {};
      applyRepoSettings(all[repo]);
      done();
    });
  }
  function persist() {
    const repo = currentRepo();
    if (typeof chrome === "undefined" || !chrome.storage?.sync || !repo) {
      return;
    }
    chrome.storage.sync.get([STORAGE_KEYS.repoSettings], (stored) => {
      const all = Object.assign({}, stored[STORAGE_KEYS.repoSettings] || {});
      const snapshot = {
        hideTests: state.hideTests,
        hideGenerated: state.hideGenerated,
        hideDeleted: state.hideDeleted,
        hideRenameOnly: state.hideRenameOnly,
        hideGlobs: state.hideGlobs.map((glob) => normalizePath(glob)).filter(Boolean)
      };
      if (isDefaultRepoSettings(snapshot)) {
        delete all[repo];
      } else {
        all[repo] = snapshot;
      }
      chrome.storage.sync.set({ [STORAGE_KEYS.repoSettings]: all });
    });
  }
  function pathFromTreeItem(item) {
    return pathFromHeaderText(item.id || item.getAttribute("aria-label") || "");
  }
  function pathFromDiffCard(card) {
    const code = card.querySelector('h3[class*="DiffFileHeader-module__file-name"] code');
    if (code) {
      return pathFromHeaderText(code.textContent);
    }
    const labeled = card.querySelector("table[aria-label^='Diff for:']");
    const aria = labeled?.getAttribute("aria-label") || "";
    return pathFromHeaderText(aria.replace(/^Diff for:\s*/i, ""));
  }
  function regionText(card) {
    return (card.textContent || "").replace(/\s+/g, " ");
  }
  function isGeneratedCard(card) {
    return Boolean(card.querySelector('[class*="HiddenDiffPatch-module__"]'));
  }
  function isDeletedCard(card) {
    if (!card) {
      return false;
    }
    const text = regionText(card);
    return /this file was deleted/i.test(text) || /\bdeleted file\b/i.test(text);
  }
  function isDeletedTreeItem(item) {
    const label = item.getAttribute("aria-label") || "";
    return /\bdeleted\b/i.test(label);
  }
  function isRenameOnlyCard(card) {
    if (!card) {
      return false;
    }
    const text = regionText(card);
    if (/file renamed without changes/i.test(text)) {
      return true;
    }
    const sr = [...card.querySelectorAll(".sr-only, [class*='sr-only']")].map((el) => el.textContent || "").join(" ");
    if (!/renamed to/i.test(sr) && !card.querySelector("h3 .octicon-arrow-right, h3 svg.octicon-arrow-right")) {
      return false;
    }
    if (isGeneratedCard(card)) {
      return false;
    }
    const hasHunks = card.querySelector(
      "td.blob-code-addition, td.blob-code-deletion, [class*='DiffHunk']"
    );
    return !hasHunks;
  }
  function isTreeLeaf(item) {
    return Boolean(item && !item.querySelector('[role="treeitem"]'));
  }
  function diffCardForTreeItem(item) {
    const row = item.querySelector(
      ':scope > [class*="TreeView-item-container"], :scope > .PRIVATE_TreeView-item-container'
    ) || item;
    const href = row.querySelector(':scope a[href^="#diff-"]')?.getAttribute("href") || "";
    const id = href.replace(/^#/, "");
    return id ? document.getElementById(id) : null;
  }
  function treeItemForPath(path) {
    if (!path) {
      return null;
    }
    const item = document.getElementById(path);
    return item && isTreeLeaf(item) ? item : null;
  }
  function hidePair(treeItem, card) {
    if (treeItem) {
      treeItem.classList.add(HIDDEN_CLASS);
    }
    if (card) {
      card.classList.add(HIDDEN_CLASS);
      card.closest('[class*="PullRequestDiffsList-module__diffEntry"]')?.classList.add(HIDDEN_CLASS);
    }
  }
  function shouldHide(path, card, treeItem) {
    if (state.hideTests && path && isTestPath(path)) {
      return true;
    }
    if (state.hideGenerated && card && isGeneratedCard(card)) {
      return true;
    }
    if (state.hideDeleted && (isDeletedCard(card) || treeItem && isDeletedTreeItem(treeItem))) {
      return true;
    }
    if (state.hideRenameOnly && isRenameOnlyCard(card)) {
      return true;
    }
    if (path && pathMatchesAnyGlob(path, state.hideGlobs)) {
      return true;
    }
    return false;
  }
  function anyFilterOn() {
    return state.hideTests || state.hideGenerated || state.hideDeleted || state.hideRenameOnly || state.hideGlobs.length > 0;
  }
  function hideEmptyTreeDirectories(scope) {
    const items = scope.querySelectorAll('#pr-file-tree li[role="treeitem"]');
    for (const item of items) {
      if (isTreeLeaf(item)) {
        continue;
      }
      const leaves = [...item.querySelectorAll('li[role="treeitem"]')].filter(isTreeLeaf);
      if (allTreeLeavesHidden(leaves.map((leaf) => leaf.classList.contains(HIDDEN_CLASS)))) {
        item.classList.add(HIDDEN_CLASS);
      }
    }
  }
  function applyFilters(root) {
    const repo = currentRepo();
    if (repo !== lastRepo) {
      loadSettings(() => applyFilters(document));
      return;
    }
    const scope = root || document;
    const previously = scope.querySelectorAll("." + HIDDEN_CLASS);
    for (const element of previously) {
      element.classList.remove(HIDDEN_CLASS);
    }
    if (!anyFilterOn()) {
      renderHiddenSummary();
      return;
    }
    const cards = scope.querySelectorAll('div[role="region"][id^="diff-"]');
    for (const card of cards) {
      const path = pathFromDiffCard(card);
      if (shouldHide(path, card, treeItemForPath(path))) {
        hidePair(treeItemForPath(path), card);
      }
    }
    const leaves = scope.querySelectorAll('#pr-file-tree li[role="treeitem"][id]');
    for (const item of leaves) {
      if (!isTreeLeaf(item)) {
        continue;
      }
      const path = pathFromTreeItem(item);
      const card = diffCardForTreeItem(item);
      if (shouldHide(path, card, item)) {
        hidePair(item, card);
      }
    }
    hideEmptyTreeDirectories(scope);
    renderHiddenSummary();
  }
  function countHidden() {
    const tests = /* @__PURE__ */ new Set();
    const generated = /* @__PURE__ */ new Set();
    const deleted = /* @__PURE__ */ new Set();
    const renamed = /* @__PURE__ */ new Set();
    const globs = {};
    function note(path, card, treeItem, fallbackId) {
      const id = path || fallbackId;
      if (!id) {
        return;
      }
      if (path && isTestPath(path)) {
        tests.add(id);
      }
      if (card && isGeneratedCard(card)) {
        generated.add(id);
      }
      if (isDeletedCard(card) || treeItem && isDeletedTreeItem(treeItem)) {
        deleted.add(id);
      }
      if (isRenameOnlyCard(card)) {
        renamed.add(id);
      }
      for (const glob of matchingGlobs(path, state.hideGlobs)) {
        globs[glob] = globs[glob] || /* @__PURE__ */ new Set();
        globs[glob].add(id);
      }
    }
    const cards = document.querySelectorAll('div[role="region"][id^="diff-"].' + HIDDEN_CLASS);
    for (const card of cards) {
      const path = pathFromDiffCard(card);
      note(path, card, treeItemForPath(path), card.id);
    }
    const leaves = document.querySelectorAll("#pr-file-tree li[role='treeitem']." + HIDDEN_CLASS);
    for (const item of leaves) {
      if (!isTreeLeaf(item)) {
        continue;
      }
      const path = pathFromTreeItem(item);
      note(path, diffCardForTreeItem(item), item, item.id);
    }
    const globCounts = {};
    for (const [glob, ids] of Object.entries(globs)) {
      globCounts[glob] = ids.size;
    }
    return {
      tests: tests.size,
      generated: generated.size,
      deleted: deleted.size,
      renamed: renamed.size,
      globs: globCounts
    };
  }
  function syncMenuChecks() {
    const testsItem = document.querySelector("[" + ITEM_ATTR$1 + '="hideTests"]');
    const list = testsItem?.closest("ul");
    if (!list) {
      return;
    }
    for (const key of ["hideTests", "hideGenerated", "hideDeleted", "hideRenameOnly"]) {
      const control = checkedControl(list, key);
      if (control) {
        setItemChecked(control, state[key]);
      }
    }
  }
  function setHide(key, value) {
    state[key] = value;
    persist();
    applyFilters(document);
    syncMenuChecks();
  }
  function uniqueGlobs(list) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const item of list) {
      const glob = normalizePath(item);
      if (!glob || seen.has(glob)) {
        continue;
      }
      seen.add(glob);
      out.push(glob);
    }
    return out;
  }
  function removeGlob(glob) {
    state.hideGlobs = state.hideGlobs.filter((item) => item !== glob);
    persist();
    applyFilters(document);
    refreshGlobRows();
  }
  function commitGlobAt(index, value) {
    const next = state.hideGlobs.slice();
    const glob = normalizePath(value);
    if (!glob) {
      next.splice(index, 1);
    } else {
      next[index] = glob;
    }
    state.hideGlobs = uniqueGlobs(next);
    persist();
    applyFilters(document);
    refreshGlobRows();
  }
  function addGlobRow() {
    state.hideGlobs = state.hideGlobs.concat([""]);
    refreshGlobRows();
    requestAnimationFrame(() => {
      const inputs = document.querySelectorAll(".nice-github-glob-input");
      const last = inputs[inputs.length - 1];
      last?.focus();
    });
  }
  function stopMenuClose(event) {
    event.stopPropagation();
  }
  function makeChip(kind, count, options) {
    const chip = document.createElement("span");
    chip.className = "nice-github-hidden-chip";
    chip.setAttribute("data-nice-github-chip", options?.glob || kind);
    const label = document.createElement("span");
    label.textContent = hiddenCountLabel(kind, count, options?.glob);
    chip.appendChild(label);
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", options?.ariaLabel || "Show files");
    button.textContent = "×";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      options?.onClear?.();
    });
    chip.appendChild(button);
    return chip;
  }
  function summaryAnchor() {
    const pane = document.getElementById("pr-file-tree");
    if (!pane) {
      return null;
    }
    return pane.querySelector('[class*="FileTreeScrollable"]') || pane.querySelector('ul[role="tree"]');
  }
  function renderHiddenSummary() {
    const anchor = summaryAnchor();
    if (!anchor || !anchor.parentElement) {
      return;
    }
    const counts = countHidden();
    const signature = JSON.stringify(counts);
    const empty = !counts.tests && !counts.generated && !counts.deleted && !counts.renamed && Object.keys(counts.globs).length === 0;
    let bar = document.getElementById(SUMMARY_ID);
    if (empty) {
      if (bar) {
        mutating$2 = true;
        bar.remove();
        mutating$2 = false;
      }
      lastCounts = signature;
      return;
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.id = SUMMARY_ID;
    }
    if (bar.nextElementSibling !== anchor) {
      mutating$2 = true;
      anchor.parentElement.insertBefore(bar, anchor);
      mutating$2 = false;
    }
    if (signature === lastCounts && bar.childElementCount > 0) {
      return;
    }
    lastCounts = signature;
    mutating$2 = true;
    bar.replaceChildren();
    if (counts.tests) {
      bar.appendChild(
        makeChip("tests", counts.tests, {
          ariaLabel: "Show tests",
          onClear: () => setHide("hideTests", false)
        })
      );
    }
    if (counts.generated) {
      bar.appendChild(
        makeChip("generated", counts.generated, {
          ariaLabel: "Show generated files",
          onClear: () => setHide("hideGenerated", false)
        })
      );
    }
    if (counts.deleted) {
      bar.appendChild(
        makeChip("deleted", counts.deleted, {
          ariaLabel: "Show deleted files",
          onClear: () => setHide("hideDeleted", false)
        })
      );
    }
    if (counts.renamed) {
      bar.appendChild(
        makeChip("renamed", counts.renamed, {
          ariaLabel: "Show rename-only files",
          onClear: () => setHide("hideRenameOnly", false)
        })
      );
    }
    for (const [glob, count] of Object.entries(counts.globs)) {
      bar.appendChild(
        makeChip("glob", count, {
          glob,
          ariaLabel: "Stop hiding " + glob,
          onClear: () => removeGlob(glob)
        })
      );
    }
    mutating$2 = false;
  }
  function itemLabel$1(node) {
    return (node.textContent || "").replace(/\s+/g, " ").trim();
  }
  function findHideWhitespaceItem(root) {
    const nodes = (root || document).querySelectorAll(
      "[role='menuitemcheckbox'], [role='menuitemradio'], button"
    );
    for (const node of nodes) {
      if (itemLabel$1(node) === "Hide whitespace") {
        return node;
      }
    }
    return null;
  }
  function setItemChecked(item, checked) {
    const control = item.matches?.("[role='menuitemcheckbox']") ? item : item.querySelector?.("[role='menuitemcheckbox']") || item;
    control.setAttribute("aria-checked", checked ? "true" : "false");
  }
  function uniqueId$1(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 9);
  }
  function retargetCloneIds$1(root) {
    const mapping = /* @__PURE__ */ new Map();
    for (const el of root.querySelectorAll("[id]")) {
      const next = uniqueId$1("nice-github");
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
        current.split(/\s+/).map((id) => mapping.get(id) || id).join(" ")
      );
    }
  }
  function setCloneLabel$1(item, label) {
    const primer = item.querySelector('[data-component="ActionList.Item.Label"]');
    if (primer) {
      primer.textContent = label;
      return;
    }
    const labelled = item.getAttribute("aria-labelledby") || "";
    const labelId = labelled.split(/\s+/)[0];
    const labelNode = labelId && item.querySelector("#" + CSS.escape(labelId)) || item.querySelector("[id$='--label']");
    if (labelNode) {
      labelNode.textContent = label;
      return;
    }
    const spans = item.querySelectorAll("span");
    for (const span of spans) {
      if (itemLabel$1(span) === "Hide whitespace") {
        span.textContent = label;
        return;
      }
    }
  }
  function makeFilterItem(template, id, label, checked, onToggle) {
    const row = template.closest("li") || template.parentElement;
    const cloneRow = row.cloneNode(true);
    cloneRow.setAttribute(ITEM_ATTR$1, id);
    retargetCloneIds$1(cloneRow);
    setCloneLabel$1(cloneRow, label);
    const control = cloneRow.querySelector("[role='menuitemcheckbox']") || cloneRow;
    control.setAttribute(ITEM_ATTR$1, id);
    control.setAttribute("role", "menuitemcheckbox");
    setItemChecked(cloneRow, checked);
    cloneRow.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onToggle();
    });
    return cloneRow;
  }
  function hideActionListCheck(row) {
    const control = row.querySelector("[role='menuitemcheckbox']") || row;
    control.setAttribute("role", "menuitem");
    control.removeAttribute("aria-checked");
    const check = row.querySelector('[data-component="ActionList.Selection"]');
    if (check instanceof HTMLElement) {
      check.style.visibility = "hidden";
      check.style.display = "none";
    }
  }
  function makeGlobRow(template, glob, index) {
    const row = template.closest("li") || template.parentElement;
    const cloneRow = row.cloneNode(true);
    cloneRow.setAttribute(ITEM_ATTR$1, "glob-row");
    cloneRow.setAttribute("data-nice-github-glob-index", String(index));
    retargetCloneIds$1(cloneRow);
    hideActionListCheck(cloneRow);
    const input = document.createElement("input");
    input.type = "text";
    input.value = glob;
    input.className = "nice-github-glob-input";
    input.setAttribute("aria-label", "Hide glob");
    input.placeholder = "*.snap";
    input.addEventListener("mousedown", stopMenuClose);
    input.addEventListener("click", stopMenuClose);
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }
    });
    input.addEventListener("blur", () => {
      commitGlobAt(index, input.value);
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "nice-github-glob-remove";
    remove.setAttribute("aria-label", "Remove glob " + glob);
    remove.textContent = "×";
    remove.addEventListener("mousedown", (event) => {
      event.preventDefault();
      stopMenuClose(event);
    });
    remove.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      commitGlobAt(index, "");
    });
    const wrap = document.createElement("span");
    wrap.className = "nice-github-glob-row";
    wrap.appendChild(input);
    wrap.appendChild(remove);
    const label = cloneRow.querySelector('[data-component="ActionList.Item.Label"]');
    if (label) {
      label.replaceChildren(wrap);
    } else {
      cloneRow.appendChild(wrap);
    }
    cloneRow.addEventListener("click", stopMenuClose);
    return cloneRow;
  }
  function makeAddGlobItem(template) {
    const row = template.closest("li") || template.parentElement;
    const cloneRow = row.cloneNode(true);
    cloneRow.setAttribute(ITEM_ATTR$1, "addGlob");
    retargetCloneIds$1(cloneRow);
    setCloneLabel$1(cloneRow, "Add glob");
    hideActionListCheck(cloneRow);
    cloneRow.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      addGlobRow();
    });
    return cloneRow;
  }
  function refreshGlobRows() {
    const whitespace = findHideWhitespaceItem(document);
    if (!whitespace) {
      return;
    }
    const list = (whitespace.closest("li") || whitespace.parentElement)?.parentElement ?? null;
    if (!list) {
      return;
    }
    syncGlobRows(list, whitespace);
  }
  function syncGlobRows(list, template) {
    if (list.querySelector(".nice-github-glob-input:focus")) {
      return;
    }
    const shown = [...list.querySelectorAll("[" + ITEM_ATTR$1 + '="glob-row"] input')].map(
      (input) => input.value
    );
    const addExists = Boolean(list.querySelector("[" + ITEM_ATTR$1 + '="addGlob"]'));
    if (addExists && JSON.stringify(shown) === JSON.stringify(state.hideGlobs)) {
      return;
    }
    mutating$2 = true;
    for (const row of list.querySelectorAll(
      "[" + ITEM_ATTR$1 + '="glob-row"], [' + ITEM_ATTR$1 + '="addGlob"], [' + ITEM_ATTR$1 + '="customGlobs"]'
    )) {
      row.remove();
    }
    const after = list.querySelector("[" + ITEM_ATTR$1 + '="hideRenameOnly"]');
    if (!after) {
      mutating$2 = false;
      return;
    }
    let insertAfter = after;
    state.hideGlobs.forEach((glob, index) => {
      const row = makeGlobRow(template, glob, index);
      insertAfter.after(row);
      insertAfter = row;
    });
    insertAfter.after(makeAddGlobItem(template));
    mutating$2 = false;
  }
  function checkedControl(list, id) {
    return list.querySelector(
      "[" + ITEM_ATTR$1 + '="' + id + '"] [role="menuitemcheckbox"], [' + ITEM_ATTR$1 + '="' + id + '"]'
    );
  }
  function injectMenuItems$1() {
    const whitespace = findHideWhitespaceItem(document);
    if (!whitespace) {
      return;
    }
    const row = whitespace.closest("li") || whitespace.parentElement;
    const list = row.parentElement;
    if (!list) {
      return;
    }
    if (list.querySelector("[" + ITEM_ATTR$1 + '="hideTests"]')) {
      syncMenuChecks();
      syncGlobRows(list, whitespace);
      return;
    }
    mutating$2 = true;
    const testsItem = makeFilterItem(whitespace, "hideTests", "Hide tests", state.hideTests, () => {
      setHide("hideTests", !state.hideTests);
    });
    const generatedItem = makeFilterItem(
      whitespace,
      "hideGenerated",
      "Hide generated files",
      state.hideGenerated,
      () => {
        setHide("hideGenerated", !state.hideGenerated);
      }
    );
    const deletedItem = makeFilterItem(
      whitespace,
      "hideDeleted",
      "Hide deleted files",
      state.hideDeleted,
      () => {
        setHide("hideDeleted", !state.hideDeleted);
      }
    );
    const renamedItem = makeFilterItem(
      whitespace,
      "hideRenameOnly",
      "Hide rename-only files",
      state.hideRenameOnly,
      () => {
        setHide("hideRenameOnly", !state.hideRenameOnly);
      }
    );
    row.after(renamedItem);
    row.after(deletedItem);
    row.after(generatedItem);
    row.after(testsItem);
    mutating$2 = false;
    syncGlobRows(list, whitespace);
  }
  function bootFileFilters() {
    injectStyle$1();
    loadSettings(() => {
      applyFilters(document);
      injectMenuItems$1();
    });
    new MutationObserver(() => {
      if (mutating$2) {
        return;
      }
      injectMenuItems$1();
      applyFilters(document);
    }).observe(document.documentElement || document, { childList: true, subtree: true });
    if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync") {
          return;
        }
        const update = changes[STORAGE_KEYS.repoSettings];
        if (!update) {
          return;
        }
        const repo = currentRepo();
        if (!repo) {
          return;
        }
        applyRepoSettings((update.newValue || {})[repo]);
        applyFilters(document);
        syncMenuChecks();
        refreshGlobRows();
      });
    }
  }
  const PR_PATH = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/(?:changes|files|commits|checks|conversation))?\/?$/;
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
  function commitUrl(owner, repo, sha, pathHash) {
    const url = "https://github.com/" + owner + "/" + repo + "/commit/" + sha;
    return pathHash ? url + "#diff-" + pathHash : url;
  }
  function encodeRef(ref) {
    return encodeURIComponent(ref);
  }
  function encodePath(path) {
    return String(path).split("/").filter((part) => part.length > 0).map(encodeURIComponent).join("/");
  }
  function latestCommitUrl(owner, repo, ref, path) {
    return "https://github.com/" + owner + "/" + repo + "/latest-commit/" + encodeRef(ref) + "/" + encodePath(path);
  }
  function blobPermalink(owner, repo, ref, path) {
    return "https://github.com/" + owner + "/" + repo + "/blob/" + encodeRef(ref) + "/" + encodePath(path);
  }
  function absoluteHref(href) {
    if (!href) {
      return null;
    }
    try {
      const url = new URL(href, "https://github.com");
      url.hash = "";
      return url.href;
    } catch {
      return null;
    }
  }
  function commitsHistoryUrl(owner, repo, ref, path) {
    return "https://github.com/" + owner + "/" + repo + "/commits/" + encodeRef(ref) + "/" + encodePath(path);
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
        path: shaMatch[2].split("/").map(decodeURIComponent).join("/")
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
      path: rest.slice(slash + 1).split("/").map(decodeURIComponent).join("/")
    };
  }
  function isSha(value) {
    return typeof value === "string" && /^[0-9a-f]{7,40}$/i.test(value);
  }
  function shaFromLatestCommitPayload(data) {
    if (!data || typeof data !== "object") {
      return null;
    }
    const rec = data;
    const sha = rec.oid || rec.sha;
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
        const rec = obj;
        const pageSha = rec.headOid || rec.headSha;
        if (isSha(pageSha) && pageSha.length === 40) {
          found = {
            sha: pageSha,
            ref: typeof rec.headRefName === "string" ? rec.headRefName : null
          };
          return;
        }
        if (rec.head && typeof rec.head === "object") {
          const head = rec.head;
          const sha = head.sha || head.oid;
          if (isSha(sha) && sha.length === 40) {
            found = {
              sha,
              ref: typeof head.ref === "string" ? head.ref : null
            };
          }
        }
      },
      0
    );
    return found;
  }
  const ITEM_ATTR = "data-nice-github-last-commit";
  const COMMIT_ICON = "M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z";
  const COPY_ICON = "M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 1 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z";
  const LINK_ICON = "M7.775 3.275a.75.75 0 0 0 1.06 1.06l1.25-1.25a2 2 0 1 1 2.83 2.83l-2.5 2.5a2 2 0 0 1-2.83 0 .75.75 0 0 0-1.06 1.06 3.5 3.5 0 0 0 4.95 0l2.5-2.5a3.5 3.5 0 0 0-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 0 1 0-2.83l2.5-2.5a2 2 0 0 1 2.83 0 .75.75 0 0 0 1.06-1.06 3.5 3.5 0 0 0-4.95 0l-2.5 2.5a3.5 3.5 0 0 0 4.95 4.95l1.25-1.25a.75.75 0 0 0-1.06-1.06l-1.25 1.25a2 2 0 0 1-2.83 0z";
  const cache = /* @__PURE__ */ new Map();
  let lastCard = null;
  let mutating$1 = false;
  function itemLabel(node) {
    return (node.textContent || "").replace(/\s+/g, " ").trim();
  }
  function uniqueId(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 9);
  }
  function retargetCloneIds(root) {
    const mapping = /* @__PURE__ */ new Map();
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
        current.split(/\s+/).map((id) => mapping.get(id) || id).join(" ")
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
    const labelNode = labelId && item.querySelector("#" + CSS.escape(labelId)) || item.querySelector("[id$='--label']");
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
  function setItemIcon(row, d) {
    const path = row.querySelector("svg path");
    if (path) {
      path.setAttribute("d", d);
    }
  }
  function setCommitIcon(row) {
    setItemIcon(row, COMMIT_ICON);
  }
  function findViewFileItem(root) {
    const nodes = (root || document).querySelectorAll(
      'a[href], button, [role="menuitem"]'
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
    return labels.includes("View file") && (labels.includes("Edit file") || labels.includes("Delete file"));
  }
  function pathFromCard(card) {
    if (!card) {
      return "";
    }
    const code = card.querySelector(
      'h3[class*="DiffFileHeader-module__file-name"] code'
    );
    if (code) {
      return pathFromHeaderText(code.textContent);
    }
    const labeled = card.querySelector("table[aria-label^='Diff for:']");
    const aria = labeled?.getAttribute("aria-label") || "";
    return pathFromHeaderText(aria.replace(/^Diff for:\s*/i, ""));
  }
  function pathHashFromCard(card) {
    const id = card?.id || "";
    return id.startsWith("diff-") ? id.slice("diff-".length) : null;
  }
  function hrefFromItem(item) {
    return item.getAttribute?.("href") || item.querySelector?.("a[href]")?.getAttribute("href") || "";
  }
  function headFromScripts() {
    for (const script of document.querySelectorAll(
      'script[type="application/json"]'
    )) {
      try {
        const head = headFromPayload(JSON.parse(script.textContent || "null"));
        if (head) {
          return head;
        }
      } catch {
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
    const pr = parsePrLocation(location.href);
    if (!pr) {
      return null;
    }
    const blob = parseBlobHref(hrefFromItem(viewFile));
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
      pathHash: pathHashFromCard(lastCard)
    };
  }
  function cacheKey(ctx) {
    return ctx.owner + "/" + ctx.repo + "@" + ctx.ref + ":" + ctx.path;
  }
  async function fetchLastCommitSha(ctx) {
    try {
      const res = await fetch(latestCommitUrl(ctx.owner, ctx.repo, ctx.ref, ctx.path), {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      });
      if (res.ok) {
        const sha = shaFromLatestCommitPayload(await res.json());
        if (sha) {
          return sha;
        }
      }
    } catch {
    }
    try {
      const res = await fetch(
        commitsHistoryUrl(ctx.owner, ctx.repo, ctx.ref, ctx.path),
        { credentials: "same-origin" }
      );
      if (res.ok) {
        const sha = shaFromCommitsHtml(await res.text());
        if (sha) {
          return sha;
        }
      }
    } catch {
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
    const fallback = commitsHistoryUrl(ctx.owner, ctx.repo, ctx.ref, ctx.path);
    setItemHref(row, fallback);
    const sha = await resolveLastCommit(ctx);
    if (!row.isConnected) {
      return;
    }
    if (sha) {
      setItemHref(row, commitUrl(ctx.owner, ctx.repo, sha, ctx.pathHash));
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
      const dest = sha ? commitUrl(ctx.owner, ctx.repo, sha, ctx.pathHash) : commitsHistoryUrl(ctx.owner, ctx.repo, ctx.ref, ctx.path);
      window.location.assign(dest);
    });
  }
  function copyText(text) {
    if (!text) {
      return Promise.resolve();
    }
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return Promise.resolve();
  }
  function permalinkFor(viewFile, ctx) {
    const fromLink = absoluteHref(hrefFromItem(viewFile));
    if (fromLink && /\/blob\//.test(fromLink)) {
      return fromLink;
    }
    return blobPermalink(ctx.owner, ctx.repo, ctx.ref, ctx.path);
  }
  function makeActionItem(template, id, label, icon, onClick) {
    const row = template.closest("li") || template.parentElement;
    const cloneRow = row.cloneNode(true);
    cloneRow.setAttribute(ITEM_ATTR, id);
    retargetCloneIds(cloneRow);
    setCloneLabel(cloneRow, label);
    setItemIcon(cloneRow, icon);
    stripKeyboardShortcut(cloneRow);
    const link = itemLink(cloneRow);
    if (link?.tagName === "A") {
      link.removeAttribute("href");
    }
    cloneRow.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      },
      true
    );
    return cloneRow;
  }
  function makeLastCommitItem(template, ctx) {
    const row = template.closest("li") || template.parentElement;
    const cloneRow = row.cloneNode(true);
    cloneRow.setAttribute(ITEM_ATTR, "last-commit");
    retargetCloneIds(cloneRow);
    setCloneLabel(cloneRow, "Last commit");
    setCommitIcon(cloneRow);
    stripKeyboardShortcut(cloneRow);
    const fallback = commitsHistoryUrl(ctx.owner, ctx.repo, ctx.ref, ctx.path);
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
    const ctx = contextFromMenu(viewFile);
    if (!ctx) {
      return;
    }
    mutating$1 = true;
    const row = viewFile.closest("li") || viewFile.parentElement;
    if (!list.querySelector("[" + ITEM_ATTR + '="last-commit"]')) {
      row.after(makeLastCommitItem(viewFile, ctx));
    }
    const lastCommit = list.querySelector("[" + ITEM_ATTR + '="last-commit"]') || row;
    if (!list.querySelector("[" + ITEM_ATTR + '="copy-path"]')) {
      lastCommit.after(
        makeActionItem(viewFile, "copy-path", "Copy path", COPY_ICON, () => {
          copyText(ctx.path);
        })
      );
    }
    const copyPath = list.querySelector("[" + ITEM_ATTR + '="copy-path"]') || lastCommit;
    if (!list.querySelector("[" + ITEM_ATTR + '="copy-permalink"]')) {
      copyPath.after(
        makeActionItem(viewFile, "copy-permalink", "Copy permalink", LINK_ICON, () => {
          copyText(permalinkFor(viewFile, ctx));
        })
      );
    }
    mutating$1 = false;
  }
  function bootFileMenu() {
    document.addEventListener(
      "pointerdown",
      (event) => {
        const card = event.target?.closest?.('div[role="region"][id^="diff-"]');
        if (card) {
          lastCard = card;
        }
      },
      true
    );
    injectMenuItems();
    new MutationObserver(() => {
      if (mutating$1) {
        return;
      }
      injectMenuItems();
    }).observe(document.documentElement || document, {
      childList: true,
      subtree: true
    });
  }
  const BRANCHES = '[class*="PullRequestHeaderBranches-module__branches"]';
  const PROCESSED = "data-nice-github-branches";
  function simplifyPullRequestHeaders(root = document) {
    root.querySelectorAll(BRANCHES).forEach((branches) => {
      if (!(branches instanceof HTMLElement) || branches.hasAttribute(PROCESSED)) {
        return;
      }
      const base = branches.querySelector(":scope > a");
      const head = branches.querySelector(":scope > div");
      const baseTooltip = base?.nextElementSibling;
      if (!(base instanceof HTMLAnchorElement) || !(head instanceof HTMLElement)) {
        return;
      }
      head.querySelector("button")?.remove();
      head.querySelector('[aria-label="Copy head branch name to clipboard"]')?.remove();
      const arrow = document.createElement("span");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "←";
      branches.replaceChildren(base, arrow, head);
      if (baseTooltip instanceof HTMLElement) {
        branches.append(baseTooltip);
      }
      const summary = branches.parentElement;
      if (summary) {
        for (const node of Array.from(summary.childNodes)) {
          if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes("wants to merge")) {
            node.remove();
          }
        }
        summary.classList.add("nice-github-merge-summary");
        summary.parentElement?.classList.add("nice-github-merge-summary-container");
      }
      branches.setAttribute(PROCESSED, "true");
    });
  }
  function normalizedLabel(element) {
    const direct = (element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || "").replace(/\s+/g, " ").trim();
    if (direct) {
      return direct;
    }
    const labelledBy = element.getAttribute("aria-labelledby") || "";
    return labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").replace(/\s+/g, " ").trim();
  }
  function isViewedLabel(element) {
    return /\bviewed\b/i.test(normalizedLabel(element));
  }
  function parseViewedCount(value) {
    const match = (value || "").replace(/\s+/g, " ").trim().match(/^(\d+)\s*(?:\/|of)\s*(\d+)\s+(?:files?\s+)?viewed$/i);
    return match ? { viewed: Number(match[1]), total: Number(match[2]) } : null;
  }
  function viewedState(control) {
    if ("checked" in control && typeof control.checked === "boolean") {
      return Boolean(control.checked);
    }
    for (const attribute of ["aria-checked", "aria-pressed"]) {
      const value = control.getAttribute(attribute);
      if (value === "true") {
        return true;
      }
      if (value === "false") {
        return false;
      }
    }
    const dataState = control.getAttribute("data-state");
    if (dataState === "checked" || dataState === "on") {
      return true;
    }
    if (dataState === "unchecked" || dataState === "off") {
      return false;
    }
    const input = control.querySelector?.('input[type="checkbox"]');
    if (input) {
      return input.checked;
    }
    const nested = control.querySelector?.(
      '[aria-checked], [aria-pressed], [data-state="checked"], [data-state="unchecked"], [data-state="on"], [data-state="off"]'
    );
    return nested ? viewedState(nested) : null;
  }
  function findViewedControls(root = document) {
    const candidates = root.querySelectorAll(
      [
        "button",
        "[aria-pressed]",
        "[aria-checked]",
        '[role="checkbox"][aria-label*="viewed" i]',
        'input[type="checkbox"][aria-label*="viewed" i]',
        'input[type="checkbox"]',
        "label"
      ].join(",")
    );
    const controls = [];
    const seen = /* @__PURE__ */ new Set();
    for (const candidate of candidates) {
      if (!isViewedLabel(candidate)) {
        continue;
      }
      let control = candidate;
      if (candidate instanceof HTMLLabelElement) {
        control = candidate.control || candidate.querySelector('input[type="checkbox"]') || (candidate.htmlFor ? document.getElementById(candidate.htmlFor) : null);
      }
      if (!control || seen.has(control) || typeof control.click !== "function") {
        continue;
      }
      seen.add(control);
      controls.push(control);
    }
    return controls;
  }
  const DEFAULT_BATCH_SIZE = 10;
  const BATCH_PAUSE_MS = 750;
  function pauseBetweenBatches() {
    return new Promise((resolve) => window.setTimeout(resolve, BATCH_PAUSE_MS));
  }
  async function setViewedControlsInBatches(controls, viewed, batchSize = DEFAULT_BATCH_SIZE, pause = pauseBetweenBatches) {
    const pending = controls.filter((control) => {
      const current = viewedState(control);
      return current !== null && current !== viewed;
    });
    let changed = 0;
    for (let offset = 0; offset < pending.length; offset += batchSize) {
      const batch = pending.slice(offset, offset + batchSize);
      for (const control of batch) {
        control.click();
        changed += 1;
      }
      if (offset + batchSize < pending.length) {
        await pause();
      }
    }
    return changed;
  }
  function setAllViewed(viewed, root = document) {
    return setViewedControlsInBatches(findViewedControls(root), viewed);
  }
  const CONTROLS_ID = "nice-github-viewed-controls";
  const STYLE_ID = "nice-github-viewed-controls-style";
  let mutating = false;
  let busy = false;
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "#" + CONTROLS_ID + "{display:inline-flex;align-items:center;gap:4px;margin-inline:8px;}",
      "#" + CONTROLS_ID + " button{",
      "height:28px;padding:0 8px;border:1px solid var(--button-default-borderColor-rest,var(--borderColor-default,#d1d9e0));",
      "border-radius:6px;background:var(--button-default-bgColor-rest,var(--bgColor-default,#f6f8fa));",
      "color:var(--button-default-fgColor-rest,var(--fgColor-default,#1f2328));font:inherit;font-size:12px;font-weight:500;cursor:pointer;",
      "}",
      "#" + CONTROLS_ID + " button:hover:not(:disabled){background:var(--button-default-bgColor-hover,var(--bgColor-muted,#f3f4f6));}",
      "#" + CONTROLS_ID + " button:disabled{opacity:.5;cursor:default;}"
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }
  function findViewedCount() {
    if (!document.body) {
      return null;
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (parseViewedCount(node.textContent)) {
        return node.parentElement;
      }
    }
    return null;
  }
  function syncButtons() {
    const viewAll = document.querySelector("#" + CONTROLS_ID + ' [data-action="view-all"]');
    const unviewAll = document.querySelector("#" + CONTROLS_ID + ' [data-action="unview-all"]');
    if (!viewAll || !unviewAll) {
      return;
    }
    if (busy) {
      viewAll.disabled = true;
      unviewAll.disabled = true;
      return;
    }
    const count = parseViewedCount(findViewedCount()?.textContent);
    viewAll.disabled = !count || count.total === 0 || count.viewed >= count.total;
    unviewAll.disabled = !count || count.viewed === 0;
  }
  function makeButton(label, action, viewed) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("data-action", action);
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (busy) {
        return;
      }
      busy = true;
      const originalLabel = button.textContent;
      button.textContent = viewed ? "Viewing…" : "Un-viewing…";
      syncButtons();
      try {
        await setAllViewed(viewed);
      } finally {
        button.textContent = originalLabel;
        busy = false;
        syncButtons();
      }
    });
    return button;
  }
  function injectControls() {
    if (document.getElementById(CONTROLS_ID)) {
      syncButtons();
      return;
    }
    const count = findViewedCount();
    if (!count?.parentElement) {
      return;
    }
    const controls = document.createElement("span");
    controls.id = CONTROLS_ID;
    controls.setAttribute("aria-label", "Bulk file viewed controls");
    controls.appendChild(makeButton("View all", "view-all", true));
    controls.appendChild(makeButton("Un-view all", "unview-all", false));
    mutating = true;
    count.after(controls);
    mutating = false;
    syncButtons();
  }
  function bootViewedFiles() {
    injectStyle();
    injectControls();
    new MutationObserver(() => {
      if (!mutating) {
        injectControls();
      }
    }).observe(document.documentElement || document, {
      attributes: true,
      attributeFilter: ["aria-checked", "aria-pressed", "checked", "data-state"],
      childList: true,
      subtree: true
    });
  }
  function rewriteLink(link) {
    const redirectedUrl = withWhitespaceHidden(link.href);
    if (redirectedUrl) {
      link.href = redirectedUrl;
    }
  }
  function rewriteDiffLinks(root = document) {
    root.querySelectorAll("a[href]").forEach((node) => {
      if (node instanceof HTMLAnchorElement) {
        rewriteLink(node);
      }
    });
  }
  function enforceWhitespaceHidden() {
    const redirectedUrl = withWhitespaceHidden(window.location.href);
    if (redirectedUrl) {
      window.location.replace(redirectedUrl);
    }
  }
  function bootContent() {
    enforceWhitespaceHidden();
    simplifyPullRequestHeaders();
    rewriteDiffLinks();
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        const link = target.closest("a[href]");
        if (link instanceof HTMLAnchorElement) {
          rewriteLink(link);
        }
      },
      true
    );
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && node instanceof Element) {
            if (node instanceof HTMLAnchorElement) {
              rewriteLink(node);
            }
            rewriteDiffLinks(node);
          }
        }
      }
      simplifyPullRequestHeaders();
    }).observe(document.documentElement || document, { childList: true, subtree: true });
    document.addEventListener("turbo:load", () => {
      enforceWhitespaceHidden();
      rewriteDiffLinks();
      simplifyPullRequestHeaders();
    });
    document.addEventListener("pjax:end", () => {
      enforceWhitespaceHidden();
      rewriteDiffLinks();
      simplifyPullRequestHeaders();
    });
  }
  bootChromeHide();
  bootContent();
  bootFileFilters();
  bootFileMenu();
  bootViewedFiles();
  exports.bootContent = bootContent;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
})({});
