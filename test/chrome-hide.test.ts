import assert from "node:assert/strict";
import { test } from "vitest";
import { CHROME_HIDE_CSS } from "../src/chrome-hide";

test("hides Copilot, Agents, and Create new in the site header", () => {
  assert.match(CHROME_HIDE_CSS, /header[\s\S]*href="\/copilot"/);
  assert.match(CHROME_HIDE_CSS, /button\[aria-label\^="Open Copilot"\]/);
  assert.match(CHROME_HIDE_CSS, /button:has\(svg\.octicon-copilot\)/);
  assert.match(CHROME_HIDE_CSS, /#global-copilot-agent-button/);
  assert.match(CHROME_HIDE_CSS, /GlobalCreateMenu-module__actionMenuButton/);
});

test("hides global Issues, Pulls, and Repositories icons inside the header only", () => {
  assert.match(CHROME_HIDE_CSS, /header[\s\S]*a\[href="\/issues"\]/);
  assert.match(CHROME_HIDE_CSS, /header[\s\S]*a\[href="\/pulls"\]/);
  assert.match(CHROME_HIDE_CSS, /header[\s\S]*a\[href="\/repos"\]/);
  assert.doesNotMatch(CHROME_HIDE_CSS, /nav\[aria-label="Repository"\][\s\S]*href="\/issues"/);
});

test("hides the repo Agents tab without targeting other repo tabs", () => {
  assert.match(CHROME_HIDE_CSS, /data-tab-item="agents"/);
  assert.match(CHROME_HIDE_CSS, /octicon-agent/);
  assert.doesNotMatch(CHROME_HIDE_CSS, /data-tab-item="issues"/);
  assert.doesNotMatch(CHROME_HIDE_CSS, /data-content="Pull requests"/);
});
