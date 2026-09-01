import assert from "node:assert/strict";
import { test } from "vitest";
import * as lastCommit from "../src/last-commit";

test("parsePrLocation accepts Files changed routes", () => {
  assert.deepEqual(
    lastCommit.parsePrLocation("https://github.com/cli/cli/pull/14313/changes?w=1"),
    { owner: "cli", repo: "cli", number: "14313" },
  );
  assert.deepEqual(
    lastCommit.parsePrLocation("https://github.com/cli/cli/pull/14313/files"),
    { owner: "cli", repo: "cli", number: "14313" },
  );
});

test("parsePrLocation rejects other GitHub pages", () => {
  assert.equal(lastCommit.parsePrLocation("https://github.com/cli/cli"), null);
  assert.equal(
    lastCommit.parsePrLocation("https://gist.github.com/cli/cli/pull/1/changes"),
    null,
  );
});

test("commitUrl can pin the file fragment", () => {
  assert.equal(
    lastCommit.commitUrl("cli", "cli", "abc123", "deadbeef"),
    "https://github.com/cli/cli/commit/abc123#diff-deadbeef",
  );
});

test("latestCommitUrl encodes the ref and path", () => {
  assert.equal(
    lastCommit.latestCommitUrl(
      "cli",
      "cli",
      "14297-no-empty-repo-name",
      "pkg/cmd/repo/create/create.go",
    ),
    "https://github.com/cli/cli/latest-commit/14297-no-empty-repo-name/pkg/cmd/repo/create/create.go",
  );
});

test("parseBlobHref reads a head SHA blob link", () => {
  assert.deepEqual(
    lastCommit.parseBlobHref(
      "/cli/cli/blob/7bf0bd988149071d1b42f0f6f384369ae0ba360d/pkg/cmd/repo/create/create.go",
    ),
    {
      owner: "cli",
      repo: "cli",
      ref: "7bf0bd988149071d1b42f0f6f384369ae0ba360d",
      path: "pkg/cmd/repo/create/create.go",
    },
  );
});

test("pathFromHeaderText uses the new name for a rename", () => {
  assert.equal(
    lastCommit.pathFromHeaderText("\u200eold.go\u200e → \u200enew.go\u200e"),
    "new.go",
  );
});

test("sha parsers accept GitHub payloads", () => {
  assert.equal(
    lastCommit.shaFromLatestCommitPayload({ oid: "7bf0bd988149071d1b42f0f6f384369ae0ba360d" }),
    "7bf0bd988149071d1b42f0f6f384369ae0ba360d",
  );
  assert.equal(
    lastCommit.shaFromCommitsApi([{ sha: "7bf0bd988149071d1b42f0f6f384369ae0ba360d" }]),
    "7bf0bd988149071d1b42f0f6f384369ae0ba360d",
  );
  assert.equal(
    lastCommit.shaFromCommitsHtml('<a href="/cli/cli/commit/7bf0bd988149071d1b42f0f6f384369ae0ba360d">'),
    "7bf0bd988149071d1b42f0f6f384369ae0ba360d",
  );
});

test("headFromPayload finds a pull request head oid", () => {
  assert.deepEqual(
    lastCommit.headFromPayload({
      nested: { headOid: "7bf0bd988149071d1b42f0f6f384369ae0ba360d", headRefName: "topic" },
    }),
    { sha: "7bf0bd988149071d1b42f0f6f384369ae0ba360d", ref: "topic" },
  );
});

test("headFromPayload also accepts headSha", () => {
  assert.deepEqual(
    lastCommit.headFromPayload({
      defaultMergeMethod: "MERGE",
      headSha: "7bf0bd988149071d1b42f0f6f384369ae0ba360d",
    }),
    { sha: "7bf0bd988149071d1b42f0f6f384369ae0ba360d", ref: null },
  );
});

test("blobPermalink builds a commitish blob URL", () => {
  assert.equal(
    lastCommit.blobPermalink(
      "cli",
      "cli",
      "7bf0bd988149071d1b42f0f6f384369ae0ba360d",
      "pkg/cmd/repo/create/create.go",
    ),
    "https://github.com/cli/cli/blob/7bf0bd988149071d1b42f0f6f384369ae0ba360d/pkg/cmd/repo/create/create.go",
  );
});
