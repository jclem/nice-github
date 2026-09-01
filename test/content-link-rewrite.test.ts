import assert from "node:assert/strict";
import { test } from "vitest";
import { withWhitespaceHidden } from "../src/diff-url";

test("a Files changed link can be rewritten before GitHub handles the click", () => {
  const link = { href: "https://github.com/acme/widget/pull/42/changes#diff-abc" };
  const destination = withWhitespaceHidden(link.href);

  if (destination) {
    link.href = destination;
  }

  assert.equal(link.href, "https://github.com/acme/widget/pull/42/changes?w=1#diff-abc");
});
