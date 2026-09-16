import assert from "node:assert/strict";
import { test } from "vitest";
import * as filters from "../src/file-filters";

test("*.test.* matches typical JS/TS test files", () => {
  assert.equal(filters.isTestPath("src/foo.test.ts"), true);
  assert.equal(filters.isTestPath("pkg/foo.test.js"), true);
  assert.equal(filters.isTestPath("foo.test.tsx"), true);
});

test("_test.* matches Go-style test files", () => {
  assert.equal(filters.isTestPath("pkg/cmd/repo/create/create_test.go"), true);
  assert.equal(filters.isTestPath("_test.py"), true);
});

test("non-test files are left visible", () => {
  assert.equal(filters.isTestPath("pkg/cmd/repo/create/create.go"), false);
  assert.equal(filters.isTestPath("test/helpers.ts"), false);
  assert.equal(filters.isTestPath("README.md"), false);
});

test("basename ignores directories", () => {
  assert.equal(filters.basename("a/b/c_test.go"), "c_test.go");
});

test("normalizePath strips LRM marks GitHub wraps around file names", () => {
  assert.equal(
    filters.normalizePath("\u200epkg/cmd/repo/create/create_test.go\u200e"),
    "pkg/cmd/repo/create/create_test.go",
  );
});

test("pathFromHeaderText uses the new name for a rename", () => {
  assert.equal(filters.pathFromHeaderText("\u200eold.go\u200e → \u200enew.go\u200e"), "new.go");
});

test("repoFromUrl reads owner/repo from a PR URL", () => {
  assert.equal(
    filters.repoFromUrl("https://github.com/cli/cli/pull/14313/changes?w=1"),
    "cli/cli",
  );
  assert.equal(filters.repoFromUrl("https://gist.github.com/cli/cli"), null);
});

test("parseGlobs splits commas and newlines", () => {
  assert.deepEqual(filters.parseGlobs("*.snap, vendor/**\npackage-lock.json"), [
    "*.snap",
    "vendor/**",
    "package-lock.json",
  ]);
});

test("pathMatchesGlob treats a nameless glob as a basename match", () => {
  assert.equal(filters.pathMatchesGlob("foo/package-lock.json", "package-lock.json"), true);
  assert.equal(filters.pathMatchesGlob("a/b.snap", "*.snap"), true);
  assert.equal(filters.pathMatchesGlob("a/b.ts", "*.snap"), false);
});

test("pathMatchesGlob supports ** across directories", () => {
  assert.equal(filters.pathMatchesGlob("vendor/foo/bar.go", "vendor/**"), true);
  assert.equal(filters.pathMatchesGlob("pkg/foo.go", "vendor/**"), false);
  assert.equal(filters.pathMatchesGlob("api/v1/types.pb.go", "**/*.pb.go"), true);
});

test("hide settings default off and ignore unknown keys", () => {
  const empty = filters.normalizeRepoSettings(undefined);
  assert.equal(empty.hideTests, false);
  assert.equal(empty.hideGenerated, false);
  assert.equal(empty.hideDeleted, false);
  assert.equal(empty.hideRenameOnly, false);
  assert.deepEqual(empty.hideGlobs, []);
  assert.equal(filters.isDefaultRepoSettings({ hideTests: true }), false);
  assert.equal(filters.isDefaultRepoSettings({ hideTests: false, hideGlobs: [] }), true);
});

test("hiddenCountLabel covers each hide type", () => {
  assert.equal(filters.hiddenCountLabel("tests", 1), "1 test hidden");
  assert.equal(filters.hiddenCountLabel("deleted", 2), "2 deleted files hidden");
  assert.equal(filters.hiddenCountLabel("renamed", 1), "1 rename-only file hidden");
  assert.equal(filters.hiddenCountLabel("glob", 3, "*.snap"), "3 *.snap hidden");
});

test("tree directories hide only when every descendant file is hidden", () => {
  assert.equal(filters.allTreeLeavesHidden([]), false);
  assert.equal(filters.allTreeLeavesHidden([true]), true);
  assert.equal(filters.allTreeLeavesHidden([true, true, true]), true);
  assert.equal(filters.allTreeLeavesHidden([true, false, true]), false);
});
