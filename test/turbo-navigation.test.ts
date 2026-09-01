import assert from "node:assert/strict";
import { test } from "vitest";
import { handleDiffClick } from "../src/turbo-navigation";

function makeClick(href: string) {
  const link = {
    href,
    closest() {
      return null;
    },
  };
  const event = {
    altKey: false,
    button: 0,
    ctrlKey: false,
    defaultPrevented: false,
    metaKey: false,
    prevented: false,
    shiftKey: false,
    stopped: false,
    target: { closest: () => link },
    preventDefault() {
      this.prevented = true;
    },
    stopImmediatePropagation() {
      this.stopped = true;
    },
  };

  return event;
}

test("normal Files changed clicks do a document navigation with w=1", () => {
  const assignments: string[] = [];
  const event = makeClick("https://github.com/acme/widget/pull/42/changes");

  handleDiffClick(event as unknown as MouseEvent, (href) => assignments.push(href));

  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.deepEqual(assignments, ["https://github.com/acme/widget/pull/42/changes?w=1"]);
});

test("legacy /files links also navigate with w=1", () => {
  const assignments: string[] = [];
  const event = makeClick("https://github.com/acme/widget/pull/42/files");

  handleDiffClick(event as unknown as MouseEvent, (href) => assignments.push(href));

  assert.equal(event.prevented, true);
  assert.deepEqual(assignments, ["https://github.com/acme/widget/pull/42/files?w=1"]);
});

test("unrelated links are left alone", () => {
  const assignments: string[] = [];
  const event = makeClick("https://github.com/acme/widget/issues/42");

  handleDiffClick(event as unknown as MouseEvent, (href) => assignments.push(href));

  assert.equal(event.prevented, false);
  assert.equal(event.stopped, false);
  assert.deepEqual(assignments, []);
});

test("an explicit w=0 link is left to GitHub", () => {
  const assignments: string[] = [];
  const event = makeClick("https://github.com/acme/widget/pull/42/changes?w=0");

  handleDiffClick(event as unknown as MouseEvent, (href) => assignments.push(href));

  assert.equal(event.prevented, false);
  assert.equal(event.stopped, false);
  assert.deepEqual(assignments, []);
});
