# Chrome Web Store listing — copy & justifications

Paste-ready text for the Web Store developer dashboard. Keeping it in the repo
so the listing and the code stay in sync.

## Store fields

- **Name:** Yes You Can Adblocker
- **Short description (≤132 chars):**
  Blocks ads and fills the empty space with bold billboard affirmations instead of just hiding it. Manifest your feed.
- **Category:** Tools (or Productivity)
- **Privacy policy URL:**
  https://github.com/willishiptoday/yes-you-can-adblocker/blob/main/PRIVACY.md
- **Store icon:** `chromium/img/icon_512.png` (resized to 128×128 by the store)

## Single purpose

> Yes You Can Adblocker blocks advertising and tracking, and replaces the
> cosmetically-hidden ad slots it removes with plain billboard tiles bearing
> motivational affirmations. Blocking ads and styling the freed space is its
> single purpose.

## Permission justifications

Paste each into the matching box under **Privacy practices**.

- **`declarativeNetRequest`** — Blocks ad and tracker network requests using
  Chrome's declarative rule engine. This is the core ad-blocking mechanism.
- **`declarativeNetRequestFeedback`** — Shows the user, in the popup, which
  rules acted on the current page (the per-site blocked-count display).
- **`scripting`** — Injects the cosmetic-filtering stylesheet and the
  affirmation-overlay script into pages to hide/replace ad elements that cannot
  be blocked at the network layer.
- **`userScripts`** — Runs the bundled, extension-authored scriptlets that
  neutralize anti-adblock and in-page ad logic. Only scripts packaged inside the
  extension are executed; no remote or user-supplied code is run.
- **`activeTab`** — Lets the toolbar popup act on the current tab (e.g. change
  that site's filtering mode).
- **`storage`** — Saves the user's own settings (per-site filtering modes,
  enabled filter lists). Local only.
- **`offscreen`** — Used by the blocking engine to do DOM/string work that the
  service worker cannot do directly.
- **Host permission `<all_urls>`** — Ad and tracker blocking must work on every
  site the user chooses to visit; the extension cannot know in advance which
  sites serve ads. No page data leaves the device.

## Data usage disclosures (check these in the dashboard)

- Does **not** collect or use personally identifiable information.
- Does **not** collect or use health, financial, authentication, personal
  communications, location, web history, or user activity data.
- Does **not** sell or transfer user data to third parties.
- Does **not** use or transfer data for purposes unrelated to the single
  purpose.
- Does **not** use or transfer data to determine creditworthiness or for
  lending.

Affirm the three certification checkboxes; all are true for this extension.

## Source-code / review note

The blocking rulesets are generated from the open-source uBlock Origin filter
lists via uBlock Origin's MV3 build, then vendored under `chromium/`. The
fork-specific source (the affirmation mechanic) is unminified under
`chromium/js/scripting/`. Full source: the GitHub repository linked above.
GPL-3.0.
