export const CHROME_HIDE_STYLE_ID = "nice-github-chrome-hide";

const HEADER = ':is(header.GlobalNav, header.AppHeader, header[role="banner"])';

/** CSS that hides crossed-out global-header chrome and the repo Agents tab. */
export const CHROME_HIDE_CSS = [
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
  'nav[aria-label="Repository"] li:has(svg.octicon-agent)',
]
  .map((selector) => selector + "{display:none !important;}")
  .join("") +
  ".nice-github-merge-summary-container{align-self:center !important;}";

export function bootChromeHide(): void {
  if (document.getElementById(CHROME_HIDE_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = CHROME_HIDE_STYLE_ID;
  style.textContent = CHROME_HIDE_CSS;
  (document.head || document.documentElement).appendChild(style);
}
