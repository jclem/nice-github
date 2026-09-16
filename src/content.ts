import { bootChromeHide } from "./chrome-hide";
import { withWhitespaceHidden } from "./diff-url";
import { bootFileFilters } from "./file-filters-ui";
import { bootFileMenu } from "./last-commit-ui";
import { bootViewedFiles } from "./viewed-files-ui";

function rewriteLink(link: HTMLAnchorElement): void {
  const redirectedUrl = withWhitespaceHidden(link.href);

  if (redirectedUrl) {
    link.href = redirectedUrl;
  }
}

function rewriteDiffLinks(root: ParentNode = document): void {
  root.querySelectorAll("a[href]").forEach((node) => {
    if (node instanceof HTMLAnchorElement) {
      rewriteLink(node);
    }
  });
}

function enforceWhitespaceHidden(): void {
  const redirectedUrl = withWhitespaceHidden(window.location.href);

  if (redirectedUrl) {
    // replace() avoids adding the unfiltered diff to the Back-button history.
    window.location.replace(redirectedUrl);
  }
}

export function bootContent(): void {
  // This is the earliest guard for direct loads.
  enforceWhitespaceHidden();

  // GitHub normally uses Turbo to transition between PR tabs. Point its link at
  // the final URL before the click, rather than redirecting after navigation.
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
    true,
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
  }).observe(document.documentElement || document, { childList: true, subtree: true });

  document.addEventListener("turbo:load", () => {
    enforceWhitespaceHidden();
    rewriteDiffLinks();
  });
  document.addEventListener("pjax:end", () => {
    enforceWhitespaceHidden();
    rewriteDiffLinks();
  });
}

bootChromeHide();
bootContent();
bootFileFilters();
bootFileMenu();
bootViewedFiles();
