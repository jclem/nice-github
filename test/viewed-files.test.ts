import assert from "node:assert/strict";
import { test } from "vitest";
import {
  parseViewedCount,
  setViewedControlsInBatches,
  viewedState,
  type ViewedControl,
} from "../src/viewed-files";

function control(attributes: Record<string, string> = {}, checked?: boolean) {
  return {
    ...(checked === undefined ? {} : { checked }),
    getAttribute(name: string) {
      return attributes[name] ?? null;
    },
    querySelector() {
      return null;
    },
  } as unknown as Element;
}

test("reads GitHub viewed controls using their accessible toggle state", () => {
  assert.equal(viewedState(control({ "aria-pressed": "true" })), true);
  assert.equal(viewedState(control({ "aria-pressed": "false" })), false);
  assert.equal(viewedState(control({ "aria-checked": "true" })), true);
});

test("supports checkbox and data-state variants", () => {
  assert.equal(viewedState(control({}, true)), true);
  assert.equal(viewedState(control({}, false)), false);
  assert.equal(viewedState(control({ "data-state": "checked" })), true);
  assert.equal(viewedState(control({ "data-state": "unchecked" })), false);
});

test("does not guess when a viewed control has no state", () => {
  assert.equal(viewedState(control()), null);
});

test("parses both GitHub viewed-count formats", () => {
  assert.deepEqual(parseViewedCount("0 / 15 viewed"), { viewed: 0, total: 15 });
  assert.deepEqual(parseViewedCount("15 of 15 files viewed"), { viewed: 15, total: 15 });
  assert.equal(parseViewedCount("Files changed"), null);
});

test("changes viewed controls in batches of ten", async () => {
  const events: string[] = [];
  const controls = Array.from({ length: 25 }, (_, index) => ({
    checked: false,
    click() {
      events.push("click:" + index);
    },
    getAttribute() {
      return null;
    },
    querySelector() {
      return null;
    },
  })) as unknown as ViewedControl[];

  const changed = await setViewedControlsInBatches(controls, true, 10, async () => {
    events.push("pause");
  });

  assert.equal(changed, 25);
  assert.deepEqual(events.slice(0, 11), [
    "click:0", "click:1", "click:2", "click:3", "click:4",
    "click:5", "click:6", "click:7", "click:8", "click:9", "pause",
  ]);
  assert.equal(events.filter((event) => event === "pause").length, 2);
  assert.deepEqual(events.slice(-5), ["click:20", "click:21", "click:22", "click:23", "click:24"]);
});
