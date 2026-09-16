export type ViewedControl = Element & { checked?: boolean; click: () => void };

function normalizedLabel(element: Element): string {
  const direct = (
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
  if (direct) {
    return direct;
  }

  const labelledBy = element.getAttribute("aria-labelledby") || "";
  return labelledBy
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function isViewedLabel(element: Element): boolean {
  return /\bviewed\b/i.test(normalizedLabel(element));
}

export function parseViewedCount(value: string | null | undefined): { viewed: number; total: number } | null {
  const match = (value || "")
    .replace(/\s+/g, " ")
    .trim()
    .match(/^(\d+)\s*(?:\/|of)\s*(\d+)\s+(?:files?\s+)?viewed$/i);
  return match ? { viewed: Number(match[1]), total: Number(match[2]) } : null;
}

export function viewedState(control: Element): boolean | null {
  if ("checked" in control && typeof (control as ViewedControl).checked === "boolean") {
    return Boolean((control as ViewedControl).checked);
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

  const input = control.querySelector?.('input[type="checkbox"]') as HTMLInputElement | null;
  if (input) {
    return input.checked;
  }

  const nested = control.querySelector?.(
    '[aria-checked], [aria-pressed], [data-state="checked"], [data-state="unchecked"], [data-state="on"], [data-state="off"]',
  );
  return nested ? viewedState(nested) : null;
}

export function findViewedControls(root: ParentNode = document): ViewedControl[] {
  const candidates = root.querySelectorAll(
    [
      "button",
      "[aria-pressed]",
      "[aria-checked]",
      '[role="checkbox"][aria-label*="viewed" i]',
      'input[type="checkbox"][aria-label*="viewed" i]',
      'input[type="checkbox"]',
      "label",
    ].join(","),
  );
  const controls: ViewedControl[] = [];
  const seen = new Set<Element>();

  for (const candidate of candidates) {
    if (!isViewedLabel(candidate)) {
      continue;
    }

    let control: Element | null = candidate;
    if (candidate instanceof HTMLLabelElement) {
      control = candidate.control ||
        candidate.querySelector('input[type="checkbox"]') ||
        (candidate.htmlFor ? document.getElementById(candidate.htmlFor) : null);
    }
    if (!control || seen.has(control) || typeof (control as ViewedControl).click !== "function") {
      continue;
    }

    seen.add(control);
    controls.push(control as ViewedControl);
  }

  return controls;
}

const DEFAULT_BATCH_SIZE = 10;
const BATCH_PAUSE_MS = 750;

function pauseBetweenBatches(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, BATCH_PAUSE_MS));
}

export async function setViewedControlsInBatches(
  controls: ViewedControl[],
  viewed: boolean,
  batchSize = DEFAULT_BATCH_SIZE,
  pause: () => Promise<void> = pauseBetweenBatches,
): Promise<number> {
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

export function setAllViewed(viewed: boolean, root: ParentNode = document): Promise<number> {
  return setViewedControlsInBatches(findViewedControls(root), viewed);
}
