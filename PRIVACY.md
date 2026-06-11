# Privacy Policy — Yes You Can Adblocker

_Last updated: 11 June 2026_

**Short version: this extension does not collect, transmit, or sell any of your
data. Everything it does happens locally in your browser.**

## What data the extension collects

None. Yes You Can Adblocker does **not** collect, log, store off-device, or
transmit any personal or usage data. Specifically, it does **not**:

- track the pages you visit or your browsing history,
- read, record, or send the content of pages you view,
- collect IP addresses, location, device identifiers, or analytics,
- use cookies, fingerprinting, or any advertising/tracking technology,
- contain any remote-analytics, telemetry, or "phone-home" code.

There are no developer-operated servers involved in the extension's operation.

## How the extension works

Yes You Can Adblocker is a content blocker. It blocks ad and tracker network
requests using Chrome's built-in
[`declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
API — the rules are bundled with the extension and matched **by Chrome itself**;
the extension never sees the requests or their contents. For ads that are hidden
cosmetically rather than blocked on the network, the extension paints a plain
billboard tile bearing a randomly chosen affirmation over the empty slot. All of
this runs entirely on your device.

## Local storage

The extension uses Chrome's `storage` API to save **your own settings** — for
example which filtering mode applies to which site. This data stays in your
browser profile (and syncs only through your own Chrome account if you have
Chrome Sync enabled). It is never sent to us or any third party.

## Permissions

The broad host access (`<all_urls>`) and the `declarativeNetRequest`,
`scripting`, `userScripts`, `activeTab`, and `storage` permissions exist solely
to filter ads and apply the affirmation overlay on the pages you visit. They are
not used to collect or exfiltrate data. See
[STORE-LISTING.md](STORE-LISTING.md) for a per-permission justification.

## Third-party services

None. The extension makes no requests to any developer-controlled service.

## Filter lists

The ad/tracker blocking rules are derived from the open-source filter lists
maintained by the uBlock Origin / uAssets project, compiled into Chrome rulesets
at build time and shipped inside the extension. No filter lists are fetched at
runtime.

## Changes to this policy

If this policy changes, the update will be published at this URL with a new
"Last updated" date.

## Contact

Questions about this policy or the extension's data practices:
open an issue at
<https://github.com/willishiptoday/yes-you-can-adblocker/issues>.
