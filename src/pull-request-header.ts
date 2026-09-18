const BRANCHES = '[class*="PullRequestHeaderBranches-module__branches"]';
const PROCESSED = "data-nice-github-branches";

/** Replaces GitHub's merge sentence with `base ← head` branch links. */
export function simplifyPullRequestHeaders(root: ParentNode = document): void {
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

    // The copy control is specific to GitHub's verbose header and would break
    // the compact branch-to-branch presentation.
    head.querySelector("button")?.remove();
    head.querySelector('[aria-label="Copy head branch name to clipboard"]')?.remove();

    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "←";

    branches.replaceChildren(base, arrow, head);
    if (baseTooltip instanceof HTMLElement) {
      branches.append(baseTooltip);
    }

    // The merge sentence is a sibling of the branch container. Remove just its
    // text node: the sticky header has additional siblings to preserve.
    const summary = branches.parentElement;
    if (summary) {
      for (const node of Array.from(summary.childNodes)) {
        if (
          node.nodeType === Node.TEXT_NODE &&
          node.textContent?.includes("wants to merge")
        ) {
          node.remove();
        }
      }
      summary.classList.add("nice-github-merge-summary");
      summary.parentElement?.classList.add("nice-github-merge-summary-container");
    }
    branches.setAttribute(PROCESSED, "true");
  });
}
