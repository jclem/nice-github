import { parseViewedCount, setAllViewed } from "./viewed-files";

const CONTROLS_ID = "nice-github-viewed-controls";
const STYLE_ID = "nice-github-viewed-controls-style";
let mutating = false;
let busy = false;

function injectStyle(): void {
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
    "#" + CONTROLS_ID + " button:disabled{opacity:.5;cursor:default;}",
  ].join("");
  (document.head || document.documentElement).appendChild(style);
}

function findViewedCount(): Element | null {
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

function syncButtons(): void {
  const viewAll = document.querySelector<HTMLButtonElement>("#" + CONTROLS_ID + ' [data-action="view-all"]');
  const unviewAll = document.querySelector<HTMLButtonElement>("#" + CONTROLS_ID + ' [data-action="unview-all"]');
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

function makeButton(label: string, action: "view-all" | "unview-all", viewed: boolean): HTMLButtonElement {
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

function injectControls(): void {
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

export function bootViewedFiles(): void {
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
    subtree: true,
  });
}
