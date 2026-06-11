// Loads the unpacked extension in Chromium, visits ad-heavy news sites, and
// saves screenshots proving affirmation tiles render where ads were.
//
//   node tools/verify.mjs [url...]
//
// Screenshots and a summary land in docs/screenshots/.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const EXT_PATH = fileURLToPath(new URL('../chromium', import.meta.url));
const OUT_DIR = fileURLToPath(new URL('../docs/screenshots', import.meta.url));
const ATTR = 'data-ubol-they-live';

const SITES = process.argv.slice(2).length > 0 ? process.argv.slice(2) : [
    'https://www.foxnews.com/',
    'https://nypost.com/',
    'https://www.independent.co.uk/',
];

mkdirSync(OUT_DIR, { recursive: true });

const context = await chromium.launchPersistentContext(
    mkdtempSync(path.join(tmpdir(), 'yyc-profile-')),
    {
        // Extensions require the persistent context; in headless mode they
        // additionally require the 'chromium' channel (new headless).
        channel: 'chromium',
        headless: true,
        args: [
            `--disable-extensions-except=${EXT_PATH}`,
            `--load-extension=${EXT_PATH}`,
        ],
        viewport: { width: 1440, height: 1200 },
    },
);

// Wait for the extension service worker, then give uBOL time to process its
// rulesets and register content scripts (first-run work).
let [worker] = context.serviceWorkers();
if (worker === undefined) {
    worker = await context.waitForEvent('serviceworker', { timeout: 30000 });
}
console.log(`extension service worker: ${worker.url()}`);
await new Promise(r => setTimeout(r, 8000));

let failures = 0;

for (const [i, site] of SITES.entries()) {
    const page = await context.newPage();
    const name = new URL(site).hostname.replace(/^www\./, '');
    try {
        await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 60000 });
        // Scroll a few viewports to trigger lazy-loaded ad slots, then return
        // to the top so the MutationObserver has tagged everything.
        for (let s = 0; s < 4; s++) {
            await page.mouse.wheel(0, 1000);
            await page.waitForTimeout(1500);
        }
        await page.waitForTimeout(3000);

        const tiles = await page.evaluate(attr => {
            const els = [...document.querySelectorAll(`[${attr}]`)];
            return els.map(el => {
                const r = el.getBoundingClientRect();
                // The affirmation is painted by the ::after overlay as a fitted
                // SVG scaled with `background-size: contain` — that's what keeps
                // text from overflowing small tiles. Guard against regressing to
                // viewport-sized text.
                const after = getComputedStyle(el, '::after');
                return {
                    phrase: el.getAttribute(attr),
                    visible: r.width >= 80 && r.height >= 40,
                    fitted: /data:image\/svg/.test(after.backgroundImage) &&
                            after.backgroundSize === 'contain',
                    top: r.top + scrollY,
                };
            });
        }, ATTR);
        const visible = tiles.filter(t => t.visible);
        const fitted = visible.filter(t => t.fitted).length;
        console.log(`${name}: ${tiles.length} tagged, ${visible.length} visible tiles, ${fitted} fitted overlays`);
        console.log(`  phrases: ${[...new Set(tiles.map(t => t.phrase))].slice(0, 8).join(' | ')}`);

        if (visible.length === 0) {
            console.log(`  !! no visible tiles on ${name}`);
            failures += 1;
        } else if (fitted === 0) {
            console.log(`  !! overlays not using fitted SVG on ${name} — text may overflow`);
            failures += 1;
        } else {
            // Bring the first decently-sized tile into view for the screenshot.
            await page.evaluate(([attr, top]) => {
                scrollTo({ top: Math.max(0, top - 300), behavior: 'instant' });
            }, [ATTR, visible[0].top]);
            await page.waitForTimeout(1500);
        }
        await page.screenshot({ path: path.join(OUT_DIR, `verify-${i + 1}-${name}.png`) });
        console.log(`  saved verify-${i + 1}-${name}.png`);
    } catch (e) {
        console.log(`${name}: FAILED — ${e.message.split('\n')[0]}`);
        failures += 1;
    } finally {
        await page.close().catch(() => {});
    }
}

await context.close();
process.exit(failures === 0 ? 0 : 1);
