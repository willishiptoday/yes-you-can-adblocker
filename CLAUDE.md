# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome MV3 content-blocker extension that **replaces cosmetically-hidden ad
elements with white billboard tiles bearing manifestation affirmations**
("$10,000,000", "ACT AS IF", "SOFT LIFE", …). It is a fork chain:

[uBlock Origin Lite](https://github.com/uBlockOrigin/uBOL-home) (Raymond Hill)
→ [They Live Adblocker](https://github.com/davmlaw/they_live_adblocker) (David Lawrence, swaps hidden ads for *They Live*-style billboards)
→ this repo (keeps the mechanic, swaps the dystopian slogans for affirmations).

There is **no build step**. The extension is the `chromium/` directory loaded
unpacked. Almost everything under `chromium/` is vendored uBOL — the original
GPL-3.0 ad-blocking engine, filter-list rulesets, locales, and dashboard UI.
The fork's own work is a handful of files (see "The custom mechanic" below).

## Commands

```bash
pnpm install            # installs Playwright (the only dependency)
pnpm verify             # = node tools/verify.mjs — screenshot proof harness
node tools/verify.mjs https://example.com/   # verify against specific URLs
```

`tools/verify.mjs` launches Chromium via Playwright with the unpacked extension,
visits ad-heavy news sites, scrolls to trigger lazy ad slots, counts elements
tagged with the `data-ubol-they-live` attribute, and writes screenshots to
`docs/screenshots/`. It exits non-zero if any site shows zero visible tiles, so
it doubles as the test suite. Requires the `chromium` Playwright channel
(`pnpm exec playwright install chromium` if missing).

There is no linter, type-checker, or unit-test framework. Package manager is
**pnpm** (`pnpm-lock.yaml`, `devEngines.packageManager`).

To load in a browser: `chrome://extensions` → Developer mode → Load unpacked →
select `chromium/`.

## The custom mechanic

uBOL's cosmetic filtering normally injects `selector { display: none !important }`
to hide matched ad elements. This fork intercepts those injection sites and
instead masks the element white and overlays a random affirmation. All of the
fork-specific logic lives in:

- **`chromium/js/scripting/they-live.js`** — the heart of the fork. Defines the
  `PHRASES` list and three globals on `self`:
  - `theyLiveCss(selectorList)` — returns CSS that masks matched elements (white
    box + black border) and adds an `::after` overlay whose `content` is read
    from the `data-ubol-they-live` attribute.
  - `theyLiveAssign(selectorList)` — walks the DOM tagging matched elements with
    a random phrase, and installs a single `MutationObserver` so late-loaded ad
    containers get tagged when they appear (the one-shot `css-specific.js` pass
    at `document_idle` would otherwise miss them).
  - `theyLiveStyleDecl(seed)` — for the procedural-CSS pipeline, which can't emit
    pseudo-elements; renders the phrase as an inline-SVG `background-image`
    instead. `seed` makes the phrase deterministic per selector.
- **Call sites** that consume those globals:
  - `chromium/js/scripting/css-specific.js` — `cssAPI.insert(theyLiveCss(...))` + `theyLiveAssign(...)`
  - `chromium/js/scripting/css-generic.js` (~line 191) — same pair
  - `chromium/js/scripting/css-procedural-api.js` (~lines 33, 641, 855) — uses `theyLiveStyleDecl`

### Invariants when editing the mechanic

- **`they-live.js` must be injected before its consumers.** `scripting-manager.js`
  (two `js.unshift(...)` sites, ~lines 110 and 211) prepends it ahead of
  `css-specific.js` / `css-generic.js`. Don't reorder those.
- **The `data-ubol-they-live` attribute name is duplicated** in `they-live.js`
  (`ATTR`) and `tools/verify.mjs` (`ATTR`). Change both together or verify
  breaks silently.
- **`css-procedural-api.js` carries an inline fallback copy of `theyLiveStyleDecl`**
  (~line 33, for when the global isn't present in that injection context). Keep
  it in sync with `they-live.js`.
- Only **cosmetically-filtered** ads become affirmations. Network-blocked ads
  (the bulk of uBOL's blocking, via `declarativeNetRequest` rulesets) never
  produce a DOM element, so there's nothing to replace. Default filtering mode
  is "Optimal"; "Complete" mode yields more cosmetic matches → more tiles.

## Vendored uBOL — treat as upstream

Everything else under `chromium/` is Raymond Hill's uBOL, largely unmodified:
`background.js` (service worker), `ruleset-manager.js`, `scripting-manager.js`,
the `rulesets/` + `_metadata/` declarativeNetRequest data, `_locales/`, the
dashboard/popup/picker UI, and the static-filtering parsers. Avoid editing these
unless a change genuinely belongs in the blocking engine — prefer to confine
fork behavior to the four files above. The whole project is GPL-3.0 (same as
upstream); preserve the existing license headers.
