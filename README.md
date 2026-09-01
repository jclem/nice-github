# Nice GitHub

A small Manifest V3 Chrome extension for GitHub pull-request reviews.

## Current behavior

Whenever a GitHub pull request's **Files changed** page is opened, the
extension ensures its URL has `w=1`, GitHub's "Hide whitespace" setting. This
also applies when opening Files changed from another pull-request tab.

GitHub currently serves this view at `/changes`; older `/files` links are also
supported.

Setting the inner PR Turbo frame to `/changes?w=1` nested a full document
inside the conversation page (duplicated headers, a stuck spinner, and an
address bar that never left `/pull/N`). Normal Files changed clicks therefore
do a document navigation to the filtered URL instead.

Other query parameters (for example a selected file anchor) are preserved. An
explicit `w=0` is respected, making it possible to opt into showing whitespace
for an individual link.

## Install locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this repository directory.
4. Open any URL like `https://github.com/OWNER/REPOSITORY/pull/123/files`.

The extension only requests access to `github.com`; it does not run a
background service worker.
