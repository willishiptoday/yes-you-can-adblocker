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
  `PACKS` (affirmations grouped into themed sets) and `THEMES` maps, and three
  globals on `self`:
  - `theyLiveCss(selectorList)` — returns CSS that masks matched elements (a
    themed tile + border) plus, once, an `[data-ubol-they-live]::after` overlay
    base and **one background-image rule per active phrase** (CSS can't read an
    attribute into a `background-image`, so each phrase gets its own
    `[…="PHRASE"]::after { background-image: <svg> }` rule). The phrase SVG is
    self-bounding (viewBox fits the text, long phrases balance onto two lines)
    and drawn `background-size: contain`, so text scales to any slot without
    overflowing. **Don't reintroduce viewport-relative font sizes** — that made
    small slots clip.
  - `theyLiveAssign(selectorList)` — walks the DOM tagging matched elements with
    a random phrase from the active set, and installs a single `MutationObserver`
    so late-loaded ad containers get tagged when they appear (the one-shot
    `css-specific.js` pass at `document_idle` would otherwise miss them).
  - `theyLiveStyleDecl(seed)` — for the procedural-CSS pipeline, which can't emit
    pseudo-elements; paints the themed phrase SVG straight onto the element as a
    `background-image`. `seed` makes the phrase deterministic per selector.
  - It also reads user settings from `chrome.storage.sync` (`yyc_settings`:
    active packs, custom phrases, theme), re-themes/re-tags live on
    `storage.onChanged`, handles a `{cmd:'yyc-reroll'}` runtime message, and
    increments a `chrome.storage.local` counter (`yyc_count`). It runs in the
    ISOLATED world (registered content script, no `world` set), so those APIs
    are available. Everything degrades to the classic look if storage is absent.
- **Control panel (fork UI, not vendored):**
  - `chromium/affirmations.html` + `chromium/js/affirmations.js` +
    `chromium/css/affirmations.css` — packs/themes/custom/re-roll, reads & writes
    `yyc_settings` / `yyc_count`. Pack & theme display metadata is mirrored here
    from `they-live.js` (keep in sync).
  - `chromium/js/yyc-popup.js` + 2 buttons added to `chromium/popup.html` — the
    "✨ Customize" / "🎲 Re-roll this page" entry points. uBOL's `popup.js` is
    untouched.
- **Call sites** that consume the scripting globals:
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
- **`css-procedural-api.js` carries an inline fallback copy** of the phrase-SVG
  builder + `theyLiveStyleDecl` (~line 33, for when the global isn't present in
  that injection context). Keep its `svgUrl`/`layoutLines` in sync with
  `they-live.js`'s `theyLiveSvgUrl` (the fallback stays classic-themed).
- **`tools/test-features.mjs`** (`pnpm test:features`) drives `chrome.storage`
  from the service worker to assert custom phrases + themes apply, re-roll
  changes phrases, and the counter increments. Run it after touching settings.
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
fork behavior to the files listed above (the scripting globals, the control
panel, and the two-line popup hook). The whole project is GPL-3.0 (same as
upstream); preserve the existing license headers.
