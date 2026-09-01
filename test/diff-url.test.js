const assert = require("node:assert/strict");
const test = require("node:test");
const { isPullRequestFilesUrl, withWhitespaceHidden } = require("../diff-url.js");

test("adds GitHub's whitespace query parameter to the current Files changed route", () => {
  assert.equal(
    withWhitespaceHidden("https://github.com/acme/widget/pull/42/changes"),
    "https://github.com/acme/widget/pull/42/changes?w=1",
  );
});

test("continues supporting the older Files changed route", () => {
  assert.equal(
    withWhitespaceHidden("https://github.com/acme/widget/pull/42/files"),
    "https://github.com/acme/widget/pull/42/files?w=1",
  );
});

test("does not override an explicit disabled whitespace setting", () => {
  assert.equal(
    withWhitespaceHidden("https://github.com/acme/widget/pull/42/changes?diff=unified&w=0#file"),
    null,
  );
});

test("leaves an already-filtered URL unchanged", () => {
  assert.equal(withWhitespaceHidden("https://github.com/acme/widget/pull/42/files?w=1"), null);
});

test("does not alter other GitHub routes or hosts", () => {
  assert.equal(isPullRequestFilesUrl("https://github.com/acme/widget/pull/42"), false);
  assert.equal(withWhitespaceHidden("https://github.com/acme/widget/pull/42"), null);
  assert.equal(withWhitespaceHidden("https://gist.github.com/acme/widget/pull/42/files"), null);
});
