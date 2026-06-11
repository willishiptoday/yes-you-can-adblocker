// Generates Chrome Web Store listing image assets into docs/store/:
//   - screenshot-*.jpg     1280x800  (real captures + a branded header bar)
//   - promo-small.jpg      440x280   small promo tile
//   - promo-marquee.jpg    1400x560  marquee promo tile
//   - store-icon-128.png   128x128   padded store icon
//
//   node tools/store-assets.mjs   (or: pnpm assets)
//
// All promo/screenshot outputs are JPEG (no alpha) to satisfy the store's
// "JPEG or 24-bit PNG (no alpha)" rule. Requires Playwright + macOS fonts
// (Impact / Arial Black) for the billboard look. Captures hit live news sites.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const EXT_PATH = fileURLToPath(new URL('../chromium', import.meta.url));
const OUT_DIR = fileURLToPath(new URL('../docs/store', import.meta.url));
const ATTR = 'data-ubol-they-live';
mkdirSync(OUT_DIR, { recursive: true });

const SHOTS = [
    { url: 'https://www.foxnews.com/', caption: 'Every blocked ad becomes an affirmation' },
    { url: 'https://nypost.com/', caption: 'Your feed, manifesting' },
    { url: 'https://www.independent.co.uk/', caption: 'Block the ads. Keep the real estate.' },
];

// A billboard tile, the way the extension paints them.
const tile = (text, fs) =>
    `<div style="flex:1;display:flex;align-items:center;justify-content:center;
        background:#fff;border:3px solid #000;border-radius:4px;
        font-family:Impact,'Arial Black',sans-serif;font-weight:900;color:#000;
        text-transform:uppercase;letter-spacing:.04em;text-align:center;
        line-height:1.05;padding:14px;font-size:${fs}px;">${text}</div>`;

const wordmark = (sub) => `
    <div style="text-align:center;font-family:Impact,'Arial Black',sans-serif;">
      <div style="font-size:64px;font-weight:900;letter-spacing:.02em;color:#000;
                  line-height:.95;text-transform:uppercase;">Yes You Can</div>
      <div style="font-size:22px;font-weight:700;letter-spacing:.28em;color:#000;
                  margin-top:10px;text-transform:uppercase;
                  font-family:'Arial Black',sans-serif;">Adblocker</div>
      <div style="font-size:17px;font-weight:600;letter-spacing:.02em;color:#444;
                  margin-top:16px;font-family:Helvetica,Arial,sans-serif;
                  text-transform:none;">${sub}</div>
    </div>`;

const context = await chromium.launchPersistentContext(
    mkdtempSync(path.join(tmpdir(), 'yyc-assets-')),
    {
        channel: 'chromium',
        headless: true,
        args: [
            `--disable-extensions-except=${EXT_PATH}`,
            `--load-extension=${EXT_PATH}`,
        ],
        viewport: { width: 1280, height: 710 },
    },
);

let [worker] = context.serviceWorkers();
if (worker === undefined) {
    worker = await context.waitForEvent('serviceworker', { timeout: 30000 });
}
await new Promise(r => setTimeout(r, 8000));

// ---- 1280x800 screenshots: real capture (1280x710) under a 90px header ----
for (const [i, shot] of SHOTS.entries()) {
    const page = await context.newPage();
    const name = new URL(shot.url).hostname.replace(/^www\./, '');
    try {
        await page.goto(shot.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        for (let s = 0; s < 4; s++) {
            await page.mouse.wheel(0, 1000);
            await page.waitForTimeout(1500);
        }
        await page.waitForTimeout(2500);
        const top = await page.evaluate(attr => {
            const el = [...document.querySelectorAll(`[${attr}]`)]
                .map(e => ({ e, r: e.getBoundingClientRect() }))
                .filter(o => o.r.width >= 120 && o.r.height >= 60)
                .sort((a, b) => (a.r.top + scrollY) - (b.r.top + scrollY))[0];
            const y = el ? el.r.top + scrollY : 0;
            scrollTo({ top: Math.max(0, y - 220), behavior: 'instant' });
            return y;
        }, ATTR);
        await page.waitForTimeout(1200);
        const raw = (await page.screenshot({ type: 'png' })).toString('base64');

        const frame = await context.newPage();
        await frame.setViewportSize({ width: 1280, height: 800 });
        await frame.setContent(`<body style="margin:0;background:#fff;width:1280px;height:800px;">
          <div style="height:90px;background:#000;color:#fff;display:flex;align-items:center;
              gap:18px;padding:0 28px;box-sizing:border-box;font-family:Impact,'Arial Black',sans-serif;">
            <span style="font-size:34px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;">Yes You Can Adblocker</span>
            <span style="font-size:19px;font-weight:600;letter-spacing:.01em;color:#bdbdbd;
                font-family:Helvetica,Arial,sans-serif;margin-left:auto;text-align:right;">${shot.caption}</span>
          </div>
          <img src="data:image/png;base64,${raw}" width="1280" height="710" style="display:block;">
        </body>`);
        await frame.waitForTimeout(200);
        await frame.screenshot({
            path: path.join(OUT_DIR, `screenshot-${i + 1}-${name}.jpg`),
            type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1280, height: 800 },
        });
        await frame.close();
        console.log(`  screenshot-${i + 1}-${name}.jpg  (tiles near y=${Math.round(top)})`);
    } catch (e) {
        console.log(`  ${name}: FAILED — ${e.message.split('\n')[0]}`);
    } finally {
        await page.close().catch(() => {});
    }
}

// ---- promo tiles + store icon: pure rendered HTML ----
const render = async (w, h, html, file, opts = {}) => {
    const p = await context.newPage();
    await p.setViewportSize({ width: w, height: h });
    await p.setContent(`<body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;">${html}</body>`);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(OUT_DIR, file), clip: { x: 0, y: 0, width: w, height: h }, ...opts });
    await p.close();
    console.log(`  ${file}`);
};

// Marquee 1400x560
await render(1400, 560, `
  <div style="width:1400px;height:560px;background:#fff;display:flex;align-items:center;
      gap:48px;padding:0 70px;box-sizing:border-box;">
    <div style="flex:0 0 480px;">${wordmark('Where an ad was, an affirmation.')}</div>
    <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:140px;gap:20px;">
      ${tile('$10,000,000', 44)}${tile('Act As If', 44)}
      ${tile('Soft Life', 44)}${tile('Money Loves Me', 38)}
    </div>
  </div>`, 'promo-marquee.jpg', { type: 'jpeg', quality: 92 });

// Small promo 440x280
await render(440, 280, `
  <div style="width:440px;height:280px;background:#fff;display:flex;flex-direction:column;
      gap:14px;padding:22px;box-sizing:border-box;">
    <div style="font-family:Impact,'Arial Black',sans-serif;font-weight:900;font-size:30px;
        text-transform:uppercase;letter-spacing:.01em;color:#000;line-height:1;">Yes You Can<br>
      <span style="font-family:'Arial Black',sans-serif;font-size:14px;letter-spacing:.26em;">Adblocker</span></div>
    <div style="flex:1;display:flex;gap:12px;">
      ${tile('$10,000,000', 26)}${tile('Glow Up', 26)}${tile('Receive', 26)}
    </div>
  </div>`, 'promo-small.jpg', { type: 'jpeg', quality: 92 });

// Padded 128x128 store icon (icon graphic ~88px, transparent margin).
const iconSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
  <rect x='9' y='9' width='110' height='110' rx='22' fill='#fff' stroke='#000' stroke-width='10'/>
  <path d='M38 66 L57 86 L92 41' fill='none' stroke='#000' stroke-width='13'
        stroke-linecap='round' stroke-linejoin='round'/></svg>`;
await render(128, 128,
    `<div style="width:128px;height:128px;display:flex;align-items:center;justify-content:center;">
       <img src="data:image/svg+xml;utf8,${encodeURIComponent(iconSvg)}" width="92" height="92">
     </div>`,
    'store-icon-128.png', { omitBackground: true });

// ---- Control-panel screenshot (showcases customization) ----
{
    const id = new URL(worker.url()).host;
    await worker.evaluate(() => new Promise(r => chrome.storage.local.set({ yyc_count: 12480 }, r)));
    await worker.evaluate(() => new Promise(r => chrome.storage.sync.set({ yyc_settings: {
        packs: { wealth: true, beauty: true, confidence: true, calm: true, career: false, petty: true },
        custom: [ 'I AM BOOKED AND BUSY', 'TODAY IS MY DAY' ], theme: 'classic',
    } }, r)));
    const p = await context.newPage();
    await p.setViewportSize({ width: 1280, height: 800 });
    await p.goto(`chrome-extension://${id}/affirmations.html`, { waitUntil: 'load' });
    await p.waitForTimeout(1000);
    await p.screenshot({
        path: path.join(OUT_DIR, 'screenshot-4-customize.jpg'),
        type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1280, height: 800 },
    });
    await p.close();
    console.log('  screenshot-4-customize.jpg');
}

await context.close();
console.log('store assets written to docs/store/');
