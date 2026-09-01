const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadClickHandler() {
  let clickHandler;
  const assignments = [];
  const window = {
    addEventListener(type, handler, capture) {
      assert.equal(type, "click");
      assert.equal(capture, true);
      clickHandler = handler;
    },
    location: {
      assign(href) {
        assignments.push(href);
      },
    },
  };

  vm.runInNewContext(fs.readFileSync(require.resolve("../turbo-navigation.js"), "utf8"), {
    URL,
    window,
  });

  return { clickHandler, assignments };
}

function makeClick(href) {
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
  const { clickHandler, assignments } = loadClickHandler();
  const event = makeClick("https://github.com/acme/widget/pull/42/changes");

  clickHandler(event);

  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.deepEqual(assignments, ["https://github.com/acme/widget/pull/42/changes?w=1"]);
});

test("legacy /files links also navigate with w=1", () => {
  const { clickHandler, assignments } = loadClickHandler();
  const event = makeClick("https://github.com/acme/widget/pull/42/files");

  clickHandler(event);

  assert.equal(event.prevented, true);
  assert.deepEqual(assignments, ["https://github.com/acme/widget/pull/42/files?w=1"]);
});

test("unrelated links are left alone", () => {
  const { clickHandler, assignments } = loadClickHandler();
  const event = makeClick("https://github.com/acme/widget/issues/42");

  clickHandler(event);

  assert.equal(event.prevented, false);
  assert.equal(event.stopped, false);
  assert.deepEqual(assignments, []);
});

test("an explicit w=0 link is left to GitHub", () => {
  const { clickHandler, assignments } = loadClickHandler();
  const event = makeClick("https://github.com/acme/widget/pull/42/changes?w=0");

  clickHandler(event);

  assert.equal(event.prevented, false);
  assert.equal(event.stopped, false);
  assert.deepEqual(assignments, []);
});
