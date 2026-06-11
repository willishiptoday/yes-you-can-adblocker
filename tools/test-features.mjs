// Behaviour test for the customization features. Loads the unpacked extension,
// drives chrome.storage from the service worker, and asserts that the content
// script reacts: custom phrases + theme apply, re-roll changes phrases, and the
// lifetime counter increments. Exits non-zero on any failed assertion.
//
//   node tools/test-features.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const EXT_PATH = fileURLToPath(new URL('../chromium', import.meta.url));
const ATTR = 'data-ubol-they-live';
const SITE = 'https://www.foxnews.com/';
const GOLD_INK = 'd4af37';
const GOLD_BORDER = 'rgb(212, 175, 55)';

let failures = 0;
const check = (name, ok, extra = '') => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
    if (!ok) failures += 1;
};

const swEval = (worker, fn, arg) => worker.evaluate(fn, arg);

const setSettings = (w, s) =>
    swEval(w, s => new Promise(r => chrome.storage.sync.set({ yyc_settings: s }, () => r(true))), s);
const clearSettings = (w) =>
    swEval(w, () => new Promise(r => chrome.storage.sync.remove('yyc_settings', () => r(true))));
const setCount = (w, n) =>
    swEval(w, n => new Promise(r => chrome.storage.local.set({ yyc_count: n }, () => r(true))), n);
const getCount = (w) =>
    swEval(w, () => new Promise(r => chrome.storage.local.get('yyc_count', d => r((d && d.yyc_count) || 0))));
const reroll = (w, urlPart) =>
    swEval(w, urlPart => new Promise(r => {
        chrome.tabs.query({}, tabs => {
            for (const t of tabs) {
                if (t.id && t.url && t.url.includes(urlPart)) {
                    chrome.tabs.sendMessage(t.id, { cmd: 'yyc-reroll' }, () => void chrome.runtime.lastError);
                }
            }
            r(true);
        });
    }), urlPart);

const readTiles = (page) => page.evaluate(attr => {
    return [...document.querySelectorAll(`[${attr}]`)].map(el => {
        const r = el.getBoundingClientRect();
        const after = getComputedStyle(el, '::after');
        return {
            phrase: el.getAttribute(attr),
            border: getComputedStyle(el).borderTopColor,
            bg: after.backgroundImage,
            visible: r.width >= 80 && r.height >= 40,
        };
    });
}, ATTR);

const openAndSettle = async (context) => {
    const page = await context.newPage();
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    for (let s = 0; s < 4; s++) { await page.mouse.wheel(0, 1000); await page.waitForTimeout(1200); }
    await page.waitForTimeout(3500); // let settings load + re-tag settle
    return page;
};

const context = await chromium.launchPersistentContext(
    mkdtempSync(path.join(tmpdir(), 'yyc-test-')),
    {
        channel: 'chromium',
        headless: true,
        args: [ `--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}` ],
        viewport: { width: 1280, height: 900 },
    },
);

let [worker] = context.serviceWorkers();
if (worker === undefined) { worker = await context.waitForEvent('serviceworker', { timeout: 30000 }); }
await new Promise(r => setTimeout(r, 8000));

try {
    // ---- Test 1: counter increments from a default load ----
    console.log('Test 1: lifetime counter');
    await clearSettings(worker);
    await setCount(worker, 0);
    let page = await openAndSettle(context);
    let tiles = (await readTiles(page)).filter(t => t.visible);
    await page.waitForTimeout(2000); // debounced counter flush (1.5s)
    const count = await getCount(worker);
    check('tiles rendered', tiles.length > 0, `${tiles.length} visible`);
    check('counter incremented past zero', count > 0, `yyc_count=${count}`);
    await page.close();

    // ---- Test 2: custom phrase + theme apply ----
    console.log('Test 2: custom affirmation + Gold theme');
    await setSettings(worker, {
        packs: { wealth: false, beauty: false, confidence: false, calm: false, career: false, petty: false },
        custom: [ 'UNIT TEST PHRASE' ],
        theme: 'gold',
    });
    page = await openAndSettle(context);
    tiles = (await readTiles(page)).filter(t => t.visible);
    const allCustom = tiles.length > 0 && tiles.every(t => t.phrase === 'UNIT TEST PHRASE');
    const goldBorder = tiles.length > 0 && tiles.every(t => t.border === GOLD_BORDER);
    const goldInk = tiles.length > 0 && tiles.every(t => t.bg.includes(GOLD_INK));
    check('every tile shows the custom phrase', allCustom,
        `${tiles.filter(t => t.phrase === 'UNIT TEST PHRASE').length}/${tiles.length}`);
    check('every tile has the Gold border', goldBorder, tiles[0] && tiles[0].border);
    check('overlay SVG uses the Gold ink', goldInk);
    await page.close();

    // ---- Test 3: re-roll changes the phrases ----
    console.log('Test 3: re-roll');
    await clearSettings(worker);
    page = await openAndSettle(context);
    const before = (await readTiles(page)).filter(t => t.visible).map(t => t.phrase);
    await reroll(worker, 'foxnews');
    await page.waitForTimeout(1500);
    const after = (await readTiles(page)).filter(t => t.visible).map(t => t.phrase);
    const changed = before.length > 0 && after.length > 0 &&
        before.join('|') !== after.join('|');
    check('phrase set changed after re-roll', changed,
        `${before.length} tiles, ${before.filter((p, i) => p !== after[i]).length} differ`);
    await page.close();
} catch (e) {
    console.log(`ERROR: ${e.message.split('\n')[0]}`);
    failures += 1;
}

await context.close();
console.log(failures === 0 ? '\nAll feature tests passed.' : `\n${failures} assertion(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
