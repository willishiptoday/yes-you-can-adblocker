// Generates the extension's original icon set from an inline SVG, so none of
// uBlock Origin's trademarked shield artwork ships in this fork.
//
// Theme: a white billboard tile with a heavy black border and a bold black
// checkmark — the same stark black-on-white "it is done" aesthetic as the
// affirmation tiles the extension paints over ads.
//
//   node tools/make-icons.mjs
//
// Writes chromium/img/icon_{16,32,64,128,512}.png (active) and the matching
// _off.png (muted, per-site-disabled state), plus chromium/img/yesyoucan.svg
// (the dashboard logo). Requires Playwright (already a devDependency).

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';

const imgDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'chromium', 'img');

// `on` true → black tile/check; false → muted grey (disabled state).
const svg = (on) => {
    const ink = on ? '#000000' : '#9aa0a6';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect x="9" y="9" width="110" height="110" rx="22"
        fill="#ffffff" stroke="${ink}" stroke-width="10"/>
  <path d="M38 66 L57 86 L92 41" fill="none" stroke="${ink}"
        stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
};

// Standalone dashboard logo (vector — stays crisp at any header size).
writeFileSync(join(imgDir, 'yesyoucan.svg'), svg(true) + '\n');

const SIZES = [16, 32, 64, 128, 512];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const on of [true, false]) {
    const dataUrl = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg(on));
    for (const size of SIZES) {
        await page.setViewportSize({ width: size, height: size });
        await page.setContent(
            `<body style="margin:0">
               <img src="${dataUrl}" width="${size}" height="${size}">
             </body>`
        );
        const el = await page.$('img');
        const name = `icon_${size}${on ? '' : '_off'}.png`;
        await el.screenshot({ path: join(imgDir, name), omitBackground: true });
        process.stdout.write(`  wrote ${name}\n`);
    }
}

await browser.close();
console.log('icons regenerated');
