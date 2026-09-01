const assert = require("node:assert/strict");
const test = require("node:test");
const { isTestPath, basename } = require("../file-filters.js");

test("*.test.* matches typical JS/TS test files", () => {
  assert.equal(isTestPath("src/foo.test.ts"), true);
  assert.equal(isTestPath("pkg/foo.test.js"), true);
  assert.equal(isTestPath("foo.test.tsx"), true);
});

test("_test.* matches Go-style test files", () => {
  assert.equal(isTestPath("pkg/cmd/repo/create/create_test.go"), true);
  assert.equal(isTestPath("_test.py"), true);
});

test("non-test files are left visible", () => {
  assert.equal(isTestPath("pkg/cmd/repo/create/create.go"), false);
  assert.equal(isTestPath("test/helpers.ts"), false);
  assert.equal(isTestPath("README.md"), false);
});

test("basename ignores directories", () => {
  assert.equal(basename("a/b/c_test.go"), "c_test.go");
});

const { normalizePath } = require("../file-filters.js");

test("normalizePath strips LRM marks GitHub wraps around file names", () => {
  assert.equal(normalizePath("\u200epkg/cmd/repo/create/create_test.go\u200e"), "pkg/cmd/repo/create/create_test.go");
});
