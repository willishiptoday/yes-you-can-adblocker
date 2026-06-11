/*******************************************************************************

    "Yes You Can" fork — replaces cosmetically-hidden ad elements with a
    billboard tile bearing a motivational / manifestation affirmation.

    Mechanic inherited from the They Live adblocker fork of uBO Lite:
    https://github.com/davmlaw/they_live_adblocker

    This file MUST run before css-specific.js, css-generic.js, and any other
    consumer that expects self.theyLiveCss / self.theyLiveAssign /
    self.theyLiveStyleDecl. css-api.js (self.cssAPI) is injected before it too.

    User settings (active packs, custom affirmations, theme) live in
    chrome.storage.sync under `yyc_settings`; a lifetime tile counter lives in
    chrome.storage.local under `yyc_count`. This runs in the ISOLATED world, so
    those APIs are available. Settings load asynchronously: defaults render
    immediately, then real settings re-theme and re-tag. Everything degrades to
    the classic look if storage is unavailable.

    Each affirmation is painted as an SVG whose viewBox tightly bounds the
    (optionally two-line) text, drawn with `background-size: contain`, so it
    scales to fit any ad slot without overflowing. Don't reintroduce viewport
    units for the text size — that made small slots clip.

*/

(function uBOL_theyLive() {

const ATTR = 'data-ubol-they-live';

// ---- Affirmation packs -----------------------------------------------------
// Union of enabled packs (+ custom lines) is the active set. The five non-petty
// packs together contain the original 30 phrases, so the default look is
// unchanged; `petty` is extra and off by default.

const PACKS = {
    wealth: [
        '$10,000,000', 'ABUNDANCE', 'MONEY LOVES ME', 'FIRST CLASS ONLY',
        'WEALTH FINDS ME', 'RECEIVE', 'IT\'S ALREADY YOURS', 'GRATEFUL IN ADVANCE',
    ],
    beauty: [
        'PERFECT PHYSIQUE', 'YOU ARE A BEAUTIFUL WOMAN', 'YOU ARE MAGNETIC',
        'SOFT LIFE', 'GLOW UP', 'HIGH VIBRATIONS ONLY',
    ],
    confidence: [
        'ACT AS IF', 'MAIN CHARACTER ENERGY', 'BORN TO WIN', 'BELIEVE HARDER',
        'I AM THE PRIZE', 'ASSUME SUCCESS', 'NOTHING IS OUT OF REACH',
    ],
    calm: [
        'WHAT IF IT\'S EASY?', 'EVERYTHING WORKS OUT FOR ME',
        'THE UNIVERSE IS LISTENING', 'IT IS DONE', 'YOU WOKE UP LUCKY',
    ],
    career: [
        'SPEAK IT INTO EXISTENCE', 'DREAM JOB INCOMING', 'REJECTION IS REDIRECTION',
        'YOUR FUTURE SELF THANKS YOU',
    ],
    petty: [
        'I AM THAT GIRL', 'UNBOTHERED', 'THEY WILL SEE', 'PLOT TWIST: I WIN',
        'BLOCK AND THRIVE', 'DELETE THE DOUBT',
    ],
};

const THEMES = {
    classic: { tile: '#ffffff', border: '#000000', ink: '#000000' },
    soft:    { tile: '#fff5f7', border: '#ff9ec4', ink: '#d1477a' },
    noir:    { tile: '#0b0b0b', border: '#ffffff', ink: '#ffffff' },
    gold:    { tile: '#0b0b0b', border: '#d4af37', ink: '#d4af37' },
    vapor:   { tile: '#1a0b2e', border: '#36e0ff', ink: '#ff6ad5' },
};

const DEFAULTS = {
    packs: { wealth: true, beauty: true, confidence: true, calm: true, career: true, petty: false },
    custom: [],
    theme: 'classic',
};

let settings = {
    packs: { ...DEFAULTS.packs },
    custom: [],
    theme: DEFAULTS.theme,
};

const currentTheme = () => THEMES[settings.theme] || THEMES.classic;

const activePhrases = () => {
    const list = [];
    for ( const key of Object.keys(PACKS) ) {
        if ( settings.packs[key] ) { list.push(...PACKS[key]); }
    }
    for ( const c of settings.custom ) {
        if ( typeof c === 'string' && c.trim() !== '' ) { list.push(c.trim()); }
    }
    const deduped = [...new Set(list)];
    return deduped.length !== 0 ? deduped : PACKS.wealth.slice();
};

const randomActive = () => {
    const a = activePhrases();
    return a[Math.floor(Math.random() * a.length)];
};

// ---- Phrase → self-bounding, themed SVG billboard --------------------------
// Duplicated as an inline fallback in css-procedural-api.js (sometimes injected
// without this global). Change both together.

const theyLiveSvgUrl = (() => {
    const xmlEsc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const layoutLines = (phrase) => {
        const words = phrase.split(' ');
        if ( words.length < 2 || phrase.length <= 11 ) { return [phrase]; }
        const half = phrase.length / 2;
        let first = '', i = 0;
        while ( i < words.length - 1 && (first + ' ' + words[i]).trim().length <= half ) {
            first = (first ? first + ' ' : '') + words[i];
            i += 1;
        }
        if ( first === '' ) { first = words[i]; i += 1; }
        const second = words.slice(i).join(' ');
        return second ? [first, second] : [first];
    };
    return (phrase, ink) => {
        const lines = layoutLines(phrase);
        const fontSize = 72, lineH = 80, charW = 46; // generous budget for Impact
        const cols = Math.max(...lines.map(l => l.length));
        const W = Math.round(cols * charW + 60);
        const H = Math.round(lines.length * lineH + 24);
        const top = (H - lines.length * lineH) / 2;
        const texts = lines.map((ln, i) =>
            `<text x='${W / 2}' y='${top + lineH * (i + 0.5)}' ` +
            `dominant-baseline='central' text-anchor='middle' ` +
            `font-family='Impact,Arial Black,sans-serif' font-weight='900' ` +
            `font-size='${fontSize}' letter-spacing='1' fill='${ink || '#000000'}'>${xmlEsc(ln)}</text>`
        ).join('');
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}'>${texts}</svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    };
})();

// Escape a phrase for use as an [attr="..."] selector value (custom phrases may
// contain quotes/backslashes).
const cssAttr = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const maskBlock = (theme) => `{
    position: relative !important;
    display: block !important;
    min-height: 60px !important;
    background: ${theme.tile} !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    border: 2px solid ${theme.border} !important;
    isolation: isolate !important;
}`;

const overlayCss = (phrases, theme) => {
    const base = `[${ATTR}]::after {
    content: '' !important;
    position: absolute !important;
    inset: 0 !important;
    z-index: 2147483647 !important;
    background-color: ${theme.tile} !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
    background-size: contain !important;
    pointer-events: none !important;
}`;
    const perPhrase = phrases.map(p =>
        `[${ATTR}="${cssAttr(p)}"]::after { background-image: url("${theyLiveSvgUrl(p, theme.ink)}") !important; }`
    ).join('\n');
    return `${base}\n${perPhrase}\n`;
};

// Selectors we've masked, so a live theme/pack change can re-emit their mask
// rule with the new colours.
const cssSelectors = new Set();
let overlayEmitted = false;

self.theyLiveCss = function(selectorList) {
    if ( typeof selectorList !== 'string' || selectorList === '' ) { return ''; }
    const selectors = selectorList
        .split(',\n')
        .map(s => s.trim())
        .filter(s => s !== '');
    if ( selectors.length === 0 ) { return ''; }
    for ( const s of selectors ) { cssSelectors.add(s); }

    const theme = currentTheme();
    const maskRule = `${selectors.join(',\n')} ${maskBlock(theme)}`;
    if ( overlayEmitted ) { return `${maskRule}\n`; }
    overlayEmitted = true;
    return `${maskRule}\n${overlayCss(activePhrases(), theme)}`;
};

// Re-insert mask + overlay with current settings (cascade: later !important
// rules win), then re-tag so existing tiles adopt the new phrases/theme.
const applyThemed = () => {
    const theme = currentTheme();
    let css = overlayCss(activePhrases(), theme);
    if ( cssSelectors.size !== 0 ) {
        css = `${[...cssSelectors].join(',\n')} ${maskBlock(theme)}\n${css}`;
    }
    if ( self.cssAPI && typeof self.cssAPI.insert === 'function' ) {
        self.cssAPI.insert(css);
    }
    reTag();
};

// ---- Tagging ---------------------------------------------------------------

const knownSelectors = new Set();
let mo;
let pendingTag = false;

const tagAll = () => {
    pendingTag = false;
    let tagged = 0;
    for ( const selector of knownSelectors ) {
        let matched;
        try {
            matched = document.querySelectorAll(selector);
        } catch {
            continue;
        }
        for ( const el of matched ) {
            if ( el.hasAttribute(ATTR) ) { continue; }
            el.setAttribute(ATTR, randomActive());
            tagged += 1;
        }
    }
    if ( tagged !== 0 ) { bumpCount(tagged); }
};

const reTag = () => {
    for ( const el of document.querySelectorAll(`[${ATTR}]`) ) {
        el.removeAttribute(ATTR);
    }
    tagAll();
};

const scheduleTag = () => {
    if ( pendingTag ) { return; }
    pendingTag = true;
    (self.requestAnimationFrame || self.setTimeout)(tagAll, 16);
};

self.theyLiveAssign = function(selectorList) {
    if ( typeof selectorList !== 'string' || selectorList === '' ) { return; }
    const selectors = selectorList
        .split(',\n')
        .map(s => s.trim())
        .filter(s => s !== '');
    for ( const s of selectors ) { knownSelectors.add(s); }
    tagAll();

    if ( mo === undefined && typeof MutationObserver !== 'undefined' ) {
        mo = new MutationObserver(scheduleTag);
        const start = () => mo.observe(document.documentElement || document, {
            childList: true, subtree: true,
        });
        if ( document.documentElement ) {
            start();
        } else {
            document.addEventListener('DOMContentLoaded', start, { once: true });
        }
    }
};

// ---- Lifetime "manifested" counter (debounced, approximate) ----------------

let pendingCount = 0;
let countTimer;
const bumpCount = (n) => {
    if ( !n ) { return; }
    if ( !self.chrome || !chrome.storage || !chrome.storage.local ) { return; }
    pendingCount += n;
    if ( countTimer !== undefined ) { return; }
    countTimer = setTimeout(() => {
        countTimer = undefined;
        const add = pendingCount;
        pendingCount = 0;
        try {
            chrome.storage.local.get('yyc_count', d => {
                if ( chrome.runtime.lastError ) { return; }
                const cur = (d && d.yyc_count) || 0;
                chrome.storage.local.set({ yyc_count: cur + add });
            });
        } catch {}
    }, 1500);
};

// ---- Settings + messaging --------------------------------------------------

const mergeSettings = (s) => {
    if ( !s || typeof s !== 'object' ) { return; }
    settings = {
        theme: typeof s.theme === 'string' ? s.theme : DEFAULTS.theme,
        custom: Array.isArray(s.custom) ? s.custom.filter(x => typeof x === 'string') : [],
        packs: { ...DEFAULTS.packs, ...(s.packs && typeof s.packs === 'object' ? s.packs : {}) },
    };
};

const initSettings = () => {
    if ( !self.chrome || !chrome.storage || !chrome.storage.sync ) { return; }
    try {
        chrome.storage.sync.get('yyc_settings', d => {
            if ( chrome.runtime.lastError ) { return; }
            if ( d && d.yyc_settings ) {
                mergeSettings(d.yyc_settings);
                applyThemed();
            }
        });
        if ( chrome.storage.onChanged ) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if ( area !== 'sync' || !changes.yyc_settings ) { return; }
                mergeSettings(changes.yyc_settings.newValue);
                applyThemed();
            });
        }
        if ( chrome.runtime && chrome.runtime.onMessage ) {
            chrome.runtime.onMessage.addListener((msg, sender, reply) => {
                if ( msg && msg.cmd === 'yyc-reroll' ) {
                    reTag();
                    try { if ( typeof reply === 'function' ) { reply({ ok: true }); } } catch {}
                }
            });
        }
    } catch {}
};

// Guard so re-injection into the same isolated world doesn't stack listeners.
if ( self.__yycSettingsInit !== true ) {
    self.__yycSettingsInit = true;
    initSettings();
}

// ---- Procedural pipeline (can't emit pseudo-elements) ----------------------

const hashStr = (s) => {
    let h = 0;
    for ( let i = 0; i < s.length; i++ ) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
};

self.theyLiveStyleDecl = function(seed) {
    const phrases = activePhrases();
    const theme = currentTheme();
    const phrase = phrases[hashStr(seed || 'yyc') % phrases.length];
    return [
        `background-color:${theme.tile} !important`,
        `background-image:url("${theyLiveSvgUrl(phrase, theme.ink)}") !important`,
        'background-repeat:no-repeat !important',
        'background-position:center !important',
        'background-size:contain !important',
        'min-height:60px !important',
        `border:2px solid ${theme.border} !important`,
        'color:transparent !important',
        'display:block !important',
    ].join(';') + ';';
};

})();

void 0;
