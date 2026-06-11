// Builds the Chrome Web Store upload zip from chromium/.
//
//   node tools/pack.mjs   (or: pnpm pack)
//
// Produces yes-you-can-adblocker-<version>.zip in the repo root. The zip holds
// the *contents* of chromium/ (manifest.json at the zip root, as the Web Store
// requires) and deliberately excludes:
//   - _metadata/   Chrome-generated; a reserved folder name → upload rejected
//   - log.txt      uBOL build log; not part of the extension
//   - .DS_Store    macOS Finder cruft
// It uses the `zip` CLI with -X so no resource-fork / __MACOSX entries are
// added (those also start with "_" and trip the same Web Store rejection).

import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = join(root, 'chromium');

const { version } = JSON.parse(
    readFileSync(join(pkgDir, 'manifest.json'), 'utf8')
);
const zipPath = join(root, `yes-you-can-adblocker-${version}.zip`);

// Start clean and drop any stale Chrome-generated artifacts on disk.
rmSync(zipPath, { force: true });
rmSync(join(pkgDir, '_metadata'), { recursive: true, force: true });
rmSync(join(pkgDir, 'log.txt'), { force: true });

execFileSync('zip', [
    '-r', '-X', '-q', zipPath, '.',
    '-x', '_metadata/*', 'log.txt', '.DS_Store', '*/.DS_Store', '*.zip',
], { cwd: pkgDir, stdio: 'inherit' });

// Verify the zip carries no reserved top-level entries (only _locales is OK).
const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
const bad = listing
    .split('\n')
    .map(l => l.split('/')[0])
    .filter(top => top.startsWith('_') && top !== '_locales');
if (bad.length !== 0) {
    console.error('REJECTED: reserved entries in zip:', [...new Set(bad)]);
    process.exit(1);
}
if (!listing.split('\n').includes('manifest.json')) {
    console.error('REJECTED: manifest.json is not at the zip root');
    process.exit(1);
}

const sizeMB = statSync(zipPath).size / 1024 / 1024;
console.log(`OK  ${zipPath.replace(root + '/', '')}  (${sizeMB.toFixed(1)} MB)`);
console.log('Upload this file at https://chrome.google.com/webstore/devconsole');
