(function () {
  "use strict";

  const HIDDEN_CLASS = "nice-github-hidden-file";
  const ITEM_ATTR = "data-nice-github-filter";
  const SUMMARY_ID = "nice-github-hidden-summary";
  const filters = globalThis.NiceGithubFileFilters;
  if (!filters) {
    return;
  }

  const state = filters.normalizeRepoSettings();
  let mutating = false;
  let lastCounts = "";
  let lastRepo = null;

  function injectStyle() {
    if (document.getElementById("nice-github-file-filter-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "nice-github-file-filter-style";
    style.textContent = [
      "." + HIDDEN_CLASS + "{display:none !important;}",
      "[" + ITEM_ATTR + '] [aria-checked="false"] [data-component="ActionList.Selection"],',
      "[" + ITEM_ATTR + '][aria-checked="false"] [data-component="ActionList.Selection"]{',
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
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }

  function currentRepo() {
    return filters.repoFromUrl(location.href);
  }

  function applyRepoSettings(value) {
    const next = filters.normalizeRepoSettings(value);
    state.hideTests = next.hideTests;
    state.hideGenerated = next.hideGenerated;
    state.hideDeleted = next.hideDeleted;
    state.hideRenameOnly = next.hideRenameOnly;
    state.hideGlobs = next.hideGlobs.slice();
  }

  function loadSettings(done) {
    lastRepo = currentRepo();
    applyRepoSettings();
    if (!globalThis.chrome?.storage?.sync || !lastRepo) {
      done();
      return;
    }

    chrome.storage.sync.get([filters.STORAGE_KEYS.repoSettings], (stored) => {
      const all = stored[filters.STORAGE_KEYS.repoSettings] || {};
      applyRepoSettings(all[lastRepo]);
      done();
    });
  }

  function persist() {
    const repo = currentRepo();
    if (!globalThis.chrome?.storage?.sync || !repo) {
      return;
    }

    chrome.storage.sync.get([filters.STORAGE_KEYS.repoSettings], (stored) => {
      const all = Object.assign({}, stored[filters.STORAGE_KEYS.repoSettings] || {});
      const snapshot = {
        hideTests: state.hideTests,
        hideGenerated: state.hideGenerated,
        hideDeleted: state.hideDeleted,
        hideRenameOnly: state.hideRenameOnly,
        hideGlobs: state.hideGlobs.slice(),
      };
      if (filters.isDefaultRepoSettings(snapshot)) {
        delete all[repo];
      } else {
        all[repo] = snapshot;
      }
      chrome.storage.sync.set({ [filters.STORAGE_KEYS.repoSettings]: all });
    });
  }

  function pathFromTreeItem(item) {
    return filters.pathFromHeaderText(item.id || item.getAttribute("aria-label") || "");
  }

  function pathFromDiffCard(card) {
    const code = card.querySelector('h3[class*="DiffFileHeader-module__file-name"] code');
    if (code) {
      return filters.pathFromHeaderText(code.textContent);
    }

    const labeled = card.querySelector("table[aria-label^='Diff for:']");
    const aria = labeled?.getAttribute("aria-label") || "";
    return filters.pathFromHeaderText(aria.replace(/^Diff for:\s*/i, ""));
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
    const sr = [...card.querySelectorAll(".sr-only, [class*='sr-only']")]
      .map((el) => el.textContent || "")
      .join(" ");
    if (!/renamed to/i.test(sr) && !card.querySelector("h3 .octicon-arrow-right, h3 svg.octicon-arrow-right")) {
      return false;
    }
    if (isGeneratedCard(card)) {
      return false;
    }
    const hasHunks = card.querySelector(
      "td.blob-code-addition, td.blob-code-deletion, [class*='DiffHunk']",
    );
    return !hasHunks;
  }

  function isTreeLeaf(item) {
    return item && !item.querySelector('[role="treeitem"]');
  }

  function diffCardForTreeItem(item) {
    const row =
      item.querySelector(
        ':scope > [class*="TreeView-item-container"], :scope > .PRIVATE_TreeView-item-container',
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
    return isTreeLeaf(item) ? item : null;
  }

  function hidePair(treeItem, card) {
    if (treeItem) {
      treeItem.classList.add(HIDDEN_CLASS);
    }
    if (card) {
      card.classList.add(HIDDEN_CLASS);
    }
  }

  function shouldHide(path, card, treeItem) {
    if (state.hideTests && path && filters.isTestPath(path)) {
      return true;
    }
    if (state.hideGenerated && card && isGeneratedCard(card)) {
      return true;
    }
    if (state.hideDeleted && (isDeletedCard(card) || (treeItem && isDeletedTreeItem(treeItem)))) {
      return true;
    }
    if (state.hideRenameOnly && isRenameOnlyCard(card)) {
      return true;
    }
    if (path && filters.pathMatchesAnyGlob(path, state.hideGlobs)) {
      return true;
    }
    return false;
  }

  function anyFilterOn() {
    return (
      state.hideTests ||
      state.hideGenerated ||
      state.hideDeleted ||
      state.hideRenameOnly ||
      state.hideGlobs.length > 0
    );
  }

  function applyFilters(root) {
    const repo = currentRepo();
    if (repo !== lastRepo) {
      loadSettings(() => applyFilters(document));
      return;
    }

    const scope = root || document;
    const previously = scope.querySelectorAll?.("." + HIDDEN_CLASS);
    if (previously) {
      for (const element of previously) {
        element.classList.remove(HIDDEN_CLASS);
      }
    }

    if (!anyFilterOn()) {
      renderHiddenSummary();
      return;
    }

    const cards = scope.querySelectorAll?.('div[role="region"][id^="diff-"]') || [];
    for (const card of cards) {
      const path = pathFromDiffCard(card);
      if (shouldHide(path, card, treeItemForPath(path))) {
        hidePair(treeItemForPath(path), card);
      }
    }

    const leaves = scope.querySelectorAll?.('#pr-file-tree li[role="treeitem"][id]') || [];
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

    renderHiddenSummary();
  }

  function countHidden() {
    const tests = new Set();
    const generated = new Set();
    const deleted = new Set();
    const renamed = new Set();
    const globs = {};

    function note(path, card, treeItem, fallbackId) {
      const id = path || fallbackId;
      if (!id) {
        return;
      }
      if (path && filters.isTestPath(path)) {
        tests.add(id);
      }
      if (card && isGeneratedCard(card)) {
        generated.add(id);
      }
      if (isDeletedCard(card) || (treeItem && isDeletedTreeItem(treeItem))) {
        deleted.add(id);
      }
      if (isRenameOnlyCard(card)) {
        renamed.add(id);
      }
      for (const glob of filters.matchingGlobs(path, state.hideGlobs)) {
        globs[glob] = globs[glob] || new Set();
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
      globs: globCounts,
    };
  }

  function syncMenuChecks() {
    const testsItem = document.querySelector("[" + ITEM_ATTR + '="hideTests"]');
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

  function removeGlob(glob) {
    state.hideGlobs = state.hideGlobs.filter((item) => item !== glob);
    persist();
    applyFilters(document);
  }

  function editGlobs() {
    const repo = currentRepo() || "this repo";
    const next = window.prompt(
      "Hide files matching these globs for " + repo + " (one per line):",
      state.hideGlobs.join("\n"),
    );
    if (next === null) {
      return;
    }
    state.hideGlobs = filters.parseGlobs(next);
    persist();
    applyFilters(document);
  }

  function makeChip(kind, count, options) {
    const chip = document.createElement("span");
    chip.className = "nice-github-hidden-chip";
    chip.setAttribute("data-nice-github-chip", options?.glob || kind);

    const label = document.createElement("span");
    label.textContent = filters.hiddenCountLabel(kind, count, options?.glob);
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
    return (
      pane.querySelector('[class*="FileTreeScrollable"]') ||
      pane.querySelector('ul[role="tree"]')
    );
  }

  function renderHiddenSummary() {
    const anchor = summaryAnchor();
    if (!anchor || !anchor.parentElement) {
      return;
    }

    const counts = countHidden();
    const signature = JSON.stringify(counts);
    const empty =
      !counts.tests &&
      !counts.generated &&
      !counts.deleted &&
      !counts.renamed &&
      Object.keys(counts.globs).length === 0;

    let bar = document.getElementById(SUMMARY_ID);
    if (empty) {
      if (bar) {
        mutating = true;
        bar.remove();
        mutating = false;
      }
      lastCounts = signature;
      return;
    }

    if (!bar) {
      bar = document.createElement("div");
      bar.id = SUMMARY_ID;
    }
    if (bar.nextElementSibling !== anchor) {
      mutating = true;
      anchor.parentElement.insertBefore(bar, anchor);
      mutating = false;
    }

    if (signature === lastCounts && bar.childElementCount > 0) {
      return;
    }

    lastCounts = signature;
    mutating = true;
    bar.replaceChildren();
    if (counts.tests) {
      bar.appendChild(
        makeChip("tests", counts.tests, {
          ariaLabel: "Show tests",
          onClear: () => setHide("hideTests", false),
        }),
      );
    }
    if (counts.generated) {
      bar.appendChild(
        makeChip("generated", counts.generated, {
          ariaLabel: "Show generated files",
          onClear: () => setHide("hideGenerated", false),
        }),
      );
    }
    if (counts.deleted) {
      bar.appendChild(
        makeChip("deleted", counts.deleted, {
          ariaLabel: "Show deleted files",
          onClear: () => setHide("hideDeleted", false),
        }),
      );
    }
    if (counts.renamed) {
      bar.appendChild(
        makeChip("renamed", counts.renamed, {
          ariaLabel: "Show rename-only files",
          onClear: () => setHide("hideRenameOnly", false),
        }),
      );
    }
    for (const [glob, count] of Object.entries(counts.globs)) {
      bar.appendChild(
        makeChip("glob", count, {
          glob,
          ariaLabel: "Stop hiding " + glob,
          onClear: () => removeGlob(glob),
        }),
      );
    }
    mutating = false;
  }

  function itemLabel(node) {
    return (node.textContent || "").replace(/\s+/g, " ").trim();
  }

  function findHideWhitespaceItem(root) {
    const nodes = (root || document).querySelectorAll(
      "[role='menuitemcheckbox'], [role='menuitemradio'], button",
    );
    for (const node of nodes) {
      if (itemLabel(node) === "Hide whitespace") {
        return node;
      }
    }
    return null;
  }

  function setItemChecked(item, checked) {
    const control =
      item.matches?.("[role='menuitemcheckbox']") ?
        item
      : item.querySelector?.("[role='menuitemcheckbox']") || item;
    control.setAttribute("aria-checked", checked ? "true" : "false");
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
      if (itemLabel(span) === "Hide whitespace") {
        span.textContent = label;
        return;
      }
    }
  }

  function makeFilterItem(template, id, label, checked, onToggle) {
    const row = template.closest("li") || template.parentElement;
    const cloneRow = row.cloneNode(true);
    cloneRow.setAttribute(ITEM_ATTR, id);
    retargetCloneIds(cloneRow);
    setCloneLabel(cloneRow, label);

    const control =
      cloneRow.querySelector("[role='menuitemcheckbox']") || cloneRow;
    control.setAttribute(ITEM_ATTR, id);
    control.setAttribute("role", "menuitemcheckbox");
    setItemChecked(cloneRow, checked);

    cloneRow.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onToggle();
    });

    return cloneRow;
  }

  function makeGlobsItem(template) {
    const row = template.closest("li") || template.parentElement;
    const cloneRow = row.cloneNode(true);
    cloneRow.setAttribute(ITEM_ATTR, "customGlobs");
    retargetCloneIds(cloneRow);
    setCloneLabel(cloneRow, "Custom globs…");

    const control =
      cloneRow.querySelector("[role='menuitemcheckbox']") || cloneRow;
    control.setAttribute(ITEM_ATTR, "customGlobs");
    control.setAttribute("role", "menuitem");
    control.removeAttribute("aria-checked");
    const check = cloneRow.querySelector('[data-component="ActionList.Selection"]');
    if (check) {
      check.style.visibility = "hidden";
    }

    cloneRow.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      editGlobs();
    });

    return cloneRow;
  }

  function checkedControl(list, id) {
    return list.querySelector(
      "[" + ITEM_ATTR + '="' + id + '"] [role="menuitemcheckbox"], [' + ITEM_ATTR + '="' + id + '"]',
    );
  }

  function injectMenuItems() {
    const whitespace = findHideWhitespaceItem(document);
    if (!whitespace) {
      return;
    }

    const row = whitespace.closest("li") || whitespace.parentElement;
    const list = row.parentElement;
    if (!list) {
      return;
    }

    if (list.querySelector("[" + ITEM_ATTR + '="hideTests"]')) {
      syncMenuChecks();
      return;
    }

    mutating = true;
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
      },
    );
    const deletedItem = makeFilterItem(
      whitespace,
      "hideDeleted",
      "Hide deleted files",
      state.hideDeleted,
      () => {
        setHide("hideDeleted", !state.hideDeleted);
      },
    );
    const renamedItem = makeFilterItem(
      whitespace,
      "hideRenameOnly",
      "Hide rename-only files",
      state.hideRenameOnly,
      () => {
        setHide("hideRenameOnly", !state.hideRenameOnly);
      },
    );
    const globsItem = makeGlobsItem(whitespace);

    row.after(globsItem);
    row.after(renamedItem);
    row.after(deletedItem);
    row.after(generatedItem);
    row.after(testsItem);
    mutating = false;
  }

  function boot() {
    injectStyle();
    loadSettings(() => {
      applyFilters(document);
      injectMenuItems();
    });

    new MutationObserver(() => {
      if (mutating) {
        return;
      }
      injectMenuItems();
      applyFilters(document);
    }).observe(document.documentElement || document, { childList: true, subtree: true });

    if (globalThis.chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync") {
          return;
        }
        const update = changes[filters.STORAGE_KEYS.repoSettings];
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
      });
    }
  }

  boot();
})();
