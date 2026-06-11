# Design: Affirmation customization (packs, themes, control panel)

_2026-06-11 — Yes You Can Adblocker_

Three user-facing features that turn the fixed 30-phrase billboard into a
personal, themeable, engaging surface. All fork-confined; the vendored uBOL
blocking engine is untouched except for two buttons added to the popup.

## Enabling fact

`they-live.js` is registered via `scripting.registerContentScripts` with no
`world` (→ ISOLATED) and the extension holds the `storage` permission, so the
content script can read/write `chrome.storage` and receive `chrome.runtime`
messages. Settings load async; defaults render immediately, then settings
re-apply (re-theme + re-tag). No regression if storage is unavailable.

## Feature 1 — Packs + custom affirmations

- Phrases organized into 6 packs: `wealth`, `beauty`, `confidence`, `calm`,
  `career`, `petty`. Active phrase set = union of enabled packs + user custom
  lines, de-duped, never empty (falls back to `wealth`).
- Stored at `chrome.storage.sync` key `yyc_settings = { packs:{...bool}, custom:[...], theme }`.
- Defaults: all packs on except `petty`; no custom; theme `classic`.

## Feature 2 — Themes

- `THEMES = { classic, soft, noir, gold, vapor }`, each `{ tile, border, ink }`.
- Tile bg + border come from CSS on the mask rule; text colour (`ink`) is baked
  into the per-phrase SVG, so a theme change regenerates the overlay CSS.
- Default `classic` (#fff / #000 / #000) == current look → zero visual change
  until the user opts in.

## Feature 3 — Control panel + counter + re-roll

- New extension page `affirmations.html` (+ `js/affirmations.js`,
  `css/affirmations.css`), on-brand (white, Impact, billboard tiles). Sections:
  live counter, theme picker, pack toggles, custom-phrase editor, re-roll.
- Counter: `chrome.storage.local` key `yyc_count`, incremented by the content
  script as it tags new tiles (debounced). Approximate by design.
- Re-roll: panel/popup → `chrome.tabs.sendMessage(tabId, {cmd:'yyc-reroll'})`
  → content script clears `data-ubol-they-live` and re-tags with fresh phrases.
- Popup: add a fork ribbon with "Customize" (opens panel) + "Re-roll" buttons,
  wired by a new `js/yyc-popup.js` (no inline JS — extension CSP). Two new lines
  in `popup.html`; uBOL's `popup.js` is not touched.

## they-live.js responsibilities (single module)

- `PACKS`, `THEMES`, `settings` (defaults), `activePhrases()`.
- `theyLiveSvgUrl(phrase, ink)` — self-bounding, two-line-balanced, themed SVG.
- `theyLiveCss(selectors)` — themed mask rule + (once) overlay base + per-phrase
  rules for the active set. Returns CSS for css-specific/generic to insert.
- Live update: on settings load / `storage.onChanged`, re-insert themed
  mask+overlay via `self.cssAPI.insert` and re-tag existing tiles.
- `chrome.runtime.onMessage` → `yyc-reroll`. Debounced counter writes.
- `theyLiveStyleDecl` (procedural path) uses the same themed SVG + active set.

## Testing

Extend `tools/verify.mjs`: (a) default render still shows fitted tiles;
(b) write `yyc_settings` with a single custom pack/phrase + a non-classic theme,
reload, assert tiles use the custom phrase and themed colour; (c) send
`yyc-reroll`, assert phrases change; (d) assert `yyc_count` increments.

## Out of scope (YAGNI)

Import/export, per-site phrase sets, scheduling, sound/animation, sharing.
