(function () {
  "use strict";

  const HIDDEN_CLASS = "nice-github-hidden-file";
  const ITEM_ATTR = "data-nice-github-filter";
  const filters = globalThis.NiceGithubFileFilters;
  if (!filters) {
    return;
  }

  const state = {
    hideTests: filters.DEFAULTS.hideTests,
    hideGenerated: filters.DEFAULTS.hideGenerated,
  };

  let mutating = false;

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
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }

  function loadSettings(done) {
    const keys = [filters.STORAGE_KEYS.hideTests, filters.STORAGE_KEYS.hideGenerated];

    if (!globalThis.chrome?.storage?.sync) {
      done();
      return;
    }

    chrome.storage.sync.get(keys, (stored) => {
      const hideTests = stored[filters.STORAGE_KEYS.hideTests];
      const hideGenerated = stored[filters.STORAGE_KEYS.hideGenerated];
      if (typeof hideTests === "boolean") {
        state.hideTests = hideTests;
      }
      if (typeof hideGenerated === "boolean") {
        state.hideGenerated = hideGenerated;
      }
      done();
    });
  }

  function persist() {
    if (!globalThis.chrome?.storage?.sync) {
      return;
    }

    chrome.storage.sync.set({
      [filters.STORAGE_KEYS.hideTests]: state.hideTests,
      [filters.STORAGE_KEYS.hideGenerated]: state.hideGenerated,
    });
  }

  function pathFromTreeItem(item) {
    return filters.normalizePath(item.id || item.getAttribute("aria-label") || "");
  }

  function pathFromDiffCard(card) {
    const code = card.querySelector('h3[class*="DiffFileHeader-module__file-name"] code');
    if (code) {
      return filters.normalizePath(code.textContent);
    }

    const labeled = card.querySelector("table[aria-label^='Diff for:']");
    const aria = labeled?.getAttribute("aria-label") || "";
    return filters.normalizePath(aria.replace(/^Diff for:\s*/i, ""));
  }

  function isGeneratedCard(card) {
    return Boolean(card.querySelector('[class*="HiddenDiffPatch-module__"]'));
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

  function applyFilters(root) {
    const scope = root || document;
    const previously = scope.querySelectorAll?.("." + HIDDEN_CLASS);
    if (previously) {
      for (const element of previously) {
        element.classList.remove(HIDDEN_CLASS);
      }
    }

    if (!state.hideTests && !state.hideGenerated) {
      return;
    }

    const cards = scope.querySelectorAll?.('div[role="region"][id^="diff-"]') || [];
    for (const card of cards) {
      const path = pathFromDiffCard(card);
      const hideTest = state.hideTests && path && filters.isTestPath(path);
      const hideGenerated = state.hideGenerated && isGeneratedCard(card);
      if (hideTest || hideGenerated) {
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
      const hideTest = state.hideTests && path && filters.isTestPath(path);
      const hideGenerated = state.hideGenerated && card && isGeneratedCard(card);
      if (hideTest || hideGenerated) {
        hidePair(item, card);
      }
    }
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
    const labelled = item.getAttribute("aria-labelledby") || "";
    const labelId = labelled.split(/\s+/)[0];
    const labelNode = (labelId && item.querySelector("#" + CSS.escape(labelId))) ||
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
      setItemChecked(checkedControl(list, "hideTests"), state.hideTests);
      setItemChecked(checkedControl(list, "hideGenerated"), state.hideGenerated);
      return;
    }

    mutating = true;
    const testsItem = makeFilterItem(
      whitespace,
      "hideTests",
      "Hide tests",
      state.hideTests,
      () => {
        state.hideTests = !state.hideTests;
        persist();
        applyFilters(document);
        setItemChecked(checkedControl(list, "hideTests"), state.hideTests);
      },
    );
    const generatedItem = makeFilterItem(
      whitespace,
      "hideGenerated",
      "Hide generated files",
      state.hideGenerated,
      () => {
        state.hideGenerated = !state.hideGenerated;
        persist();
        applyFilters(document);
        setItemChecked(checkedControl(list, "hideGenerated"), state.hideGenerated);
      },
    );

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
        const tests = changes[filters.STORAGE_KEYS.hideTests];
        const generated = changes[filters.STORAGE_KEYS.hideGenerated];
        if (tests && typeof tests.newValue === "boolean") {
          state.hideTests = tests.newValue;
        }
        if (generated && typeof generated.newValue === "boolean") {
          state.hideGenerated = generated.newValue;
        }
        applyFilters(document);
      });
    }
  }

  boot();
})();
