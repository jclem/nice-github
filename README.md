# Nice GitHub

A small Manifest V3 Chrome extension for GitHub pull-request reviews.

TypeScript sources live in `src/`. Vite bundles them into `dist/` as two IIFE
content scripts (`content.js` in the isolated world, `turbo-navigation.js` in
the MAIN world).

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

The Files changed gear menu (Layout) also gets hide toggles for **tests**,
**generated files**, **deleted files**, and **rename-only files**. **Add glob**
adds an editable path pattern for this repo (typed in the menu; there is no
`window.prompt`). Each glob is its own line with an × to remove it. Tests
match `*.test.*` and `_test.*`. Generated files are ones GitHub already marks
as generated. Every hide option defaults off and is stored per repository.

When files are hidden, the PR file tree shows a count for each type. Clicking
the × on a count turns that filter off (or removes that glob) and shows those
files again.

Each file's overflow menu also gets **Copy path** and **Copy permalink**.

Each file's overflow menu (the `...` next to Viewed) also gets **Last commit**,
which opens the most recent commit that modified that file on the pull request
head.

The global site header hides Copilot, Agents, Create new, Issues, Pull
requests, and Repositories. Search, inbox, and the avatar stay. On a
repository, the Agents tab is hidden; other repo tabs stay.

## Install locally

1. Run `npm install` and `npm run build` in this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the `dist/` directory.
5. Open any URL like `https://github.com/OWNER/REPOSITORY/pull/123/files`.

The extension only requests access to `github.com`; it does not run a
background service worker.
