# Yes You Can Adblocker — extension package

This folder **is** the unpacked Chrome MV3 extension. There is no build step for
the fork itself: load this directory via `chrome://extensions` → Developer mode
→ Load unpacked, or zip its contents for the Chrome Web Store.

- Project home & full source: <https://github.com/willishiptoday/yes-you-can-adblocker>
- License: GPL-3.0 (see `LICENSE.txt`)

## What's a fork vs. what's vendored

The fork-specific code (the affirmation mechanic) is unminified and lives in
`js/scripting/they-live.js` plus its call sites in
`js/scripting/css-{specific,generic,procedural-api}.js`.

Everything else here is [uBlock Origin Lite](https://github.com/uBlockOrigin/uBOL-home)
by Raymond Hill, largely unmodified: the service worker, the cosmetic-filtering
engine, the UI, the locales, and the `rulesets/` blocking data.

## Regenerating the blocking rulesets (reviewers)

The `declarativeNetRequest` rulesets under `rulesets/` are compiled from the
open-source uBlock Origin / uAssets filter lists by uBlock Origin's MV3 build
(`make mv3-chromium` in <https://github.com/gorhill/uBlock>), then vendored
here. They are not authored by hand and are not fetched at runtime.

## Do not commit / ship

Chrome writes a `_metadata/` folder and a `log.txt` into this directory when it
loads the extension unpacked. Both are git-ignored and **must not** be included
in the uploaded zip — `_metadata` is a reserved folder name and the Web Store
rejects packages that contain it.
