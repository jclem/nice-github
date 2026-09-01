import * as helpers from "./last-commit";



const ITEM_ATTR = "data-nice-github-last-commit";
const COMMIT_ICON =
  "M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z";

const COPY_ICON =
  "M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 1 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z";

const LINK_ICON =
  "M7.775 3.275a.75.75 0 0 0 1.06 1.06l1.25-1.25a2 2 0 1 1 2.83 2.83l-2.5 2.5a2 2 0 0 1-2.83 0 .75.75 0 0 0-1.06 1.06 3.5 3.5 0 0 0 4.95 0l2.5-2.5a3.5 3.5 0 0 0-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 0 1 0-2.83l2.5-2.5a2 2 0 0 1 2.83 0 .75.75 0 0 0 1.06-1.06 3.5 3.5 0 0 0-4.95 0l-2.5 2.5a3.5 3.5 0 0 0 4.95 4.95l1.25-1.25a.75.75 0 0 0-1.06-1.06l-1.25 1.25a2 2 0 0 1-2.83 0z";

type FileContext = {
  owner: string;
  repo: string;
  ref: string;
  path: string;
  pathHash: string | null;
};

const cache = new Map<string, Promise<string | null>>();
let lastCard: Element | null = null;
let mutating = false;

function itemLabel(node: Element) {
  return (node.textContent || "").replace(/\s+/g, " ").trim();
}

function uniqueId(prefix: string) {
  return prefix + "-" + Math.random().toString(36).slice(2, 9);
}

function retargetCloneIds(root: Element) {
  const mapping = new Map<string, string>();
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

function setCloneLabel(item: Element, label: string) {
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

function stripKeyboardShortcut(row: Element) {
  for (const el of [row, ...row.querySelectorAll("*")]) {
    el.removeAttribute?.("aria-keyshortcuts");
    el.removeAttribute?.("data-hotkey");
    el.removeAttribute?.("data-keyshortcut");
  }
  for (const hint of row.querySelectorAll("kbd, [data-component='ActionList.Item.TrailingVisual']")) {
    hint.remove();
  }
}

function setItemIcon(row: Element, d: string) {
  const path = row.querySelector("svg path");
  if (path) {
    path.setAttribute("d", d);
  }
}

function setCommitIcon(row: Element) {
  setItemIcon(row, COMMIT_ICON);
}

function findViewFileItem(root?: ParentNode | Document | null) {
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

function menuListFor(item: Element) {
  const row = item.closest("li") || item.parentElement;
  return row?.parentElement || null;
}

function isFileKebabMenu(list: Element | null): list is Element {
  if (!list) {
    return false;
  }
  const labels: string[] = [];
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

function pathFromCard(card: Element | null) {
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

function pathHashFromCard(card: Element | null) {
  const id = card?.id || "";
  return id.startsWith("diff-") ? id.slice("diff-".length) : null;
}

function hrefFromItem(item: Element) {
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
      const head = helpers.headFromPayload(JSON.parse(script.textContent || "null"));
      if (head) {
        return head;
      }
    } catch {
      // Ignore unrelated JSON blobs GitHub embeds on the page.
    }
  }
  return null;
}

function headFromDom(owner: string, repo: string) {
  const prefix = "/" + owner + "/" + repo + "/tree/";
  const links = document.querySelectorAll('a[href^="' + prefix + '"]');
  const href = links[links.length - 1]?.getAttribute("href") || "";
  const rest = decodeURIComponent(href.slice(prefix.length).split(/[?#]/)[0] || "");
  if (!rest) {
    return null;
  }
  return { ref: rest.split("/")[0] };
}

function contextFromMenu(viewFile: Element): FileContext | null {
  const pr = helpers.parsePrLocation(location.href);
  if (!pr) {
    return null;
  }

  const blob = helpers.parseBlobHref(hrefFromItem(viewFile));
  const path = pathFromCard(lastCard) || blob?.path;
  if (!path) {
    return null;
  }

  const head: { sha?: string; ref?: string | null } | null = headFromScripts() || headFromDom(pr.owner, pr.repo);
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

function cacheKey(ctx: FileContext) {
  return ctx.owner + "/" + ctx.repo + "@" + ctx.ref + ":" + ctx.path;
}

async function fetchLastCommitSha(ctx: FileContext) {
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

function resolveLastCommit(ctx: FileContext) {
  const key = cacheKey(ctx);
  if (!cache.has(key)) {
    cache.set(key, fetchLastCommitSha(ctx));
  }
  return cache.get(key)!;
}

function itemLink(row: Element) {
  return row.querySelector("a[href]") || row.querySelector("[role='menuitem']") || row;
}

function setItemHref(row: Element, href: string) {
  const link = itemLink(row);
  if (link?.tagName === "A") {
    link.setAttribute("href", href);
  }
}

async function fillCommitHref(row: Element, ctx: FileContext) {
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

function onLastCommitClick(event: Event, ctx: FileContext, row: Element) {
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

function copyText(text: string | null | undefined) {
  if (!text) {
    return Promise.resolve();
  }
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.resolve();
}

function permalinkFor(viewFile: Element, ctx: FileContext) {
  const fromLink = helpers.absoluteHref(hrefFromItem(viewFile));
  if (fromLink && /\/blob\//.test(fromLink)) {
    return fromLink;
  }
  return helpers.blobPermalink(ctx.owner, ctx.repo, ctx.ref, ctx.path);
}

function makeActionItem(template: Element, id: string, label: string, icon: string, onClick: () => void) {
  const row = (template.closest("li") || template.parentElement) as HTMLElement;
  const cloneRow = row.cloneNode(true) as HTMLElement;
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
    true,
  );
  return cloneRow;
}

function makeLastCommitItem(template: Element, ctx: FileContext) {
  const row = (template.closest("li") || template.parentElement) as HTMLElement;
  const cloneRow = row.cloneNode(true) as HTMLElement;
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

  const ctx = contextFromMenu(viewFile);
  if (!ctx) {
    return;
  }

  mutating = true;
  const row = (viewFile.closest("li") || viewFile.parentElement) as HTMLElement;
  if (!list.querySelector("[" + ITEM_ATTR + '="last-commit"]')) {
    row.after(makeLastCommitItem(viewFile, ctx));
  }
  const lastCommit = list.querySelector("[" + ITEM_ATTR + '="last-commit"]') || row;
  if (!list.querySelector("[" + ITEM_ATTR + '="copy-path"]')) {
    lastCommit.after(
      makeActionItem(viewFile, "copy-path", "Copy path", COPY_ICON, () => {
        copyText(ctx.path);
      }),
    );
  }
  const copyPath = list.querySelector("[" + ITEM_ATTR + '="copy-path"]') || lastCommit;
  if (!list.querySelector("[" + ITEM_ATTR + '="copy-permalink"]')) {
    copyPath.after(
      makeActionItem(viewFile, "copy-permalink", "Copy permalink", LINK_ICON, () => {
        copyText(permalinkFor(viewFile, ctx));
      }),
    );
  }
  mutating = false;
}

export function bootFileMenu() {
  document.addEventListener(
    "pointerdown",
    (event) => {
      const card = (event.target as Element | null)?.closest?.('div[role="region"][id^="diff-"]');
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


