/*******************************************************************************

    "Yes You Can" fork — replaces cosmetically-hidden ad elements with a
    white billboard tile bearing a motivational / manifestation affirmation.

    Mechanic inherited from the They Live adblocker fork of uBO Lite:
    https://github.com/davmlaw/they_live_adblocker

    This file MUST run before css-specific.js, css-generic.js, and any other
    consumer that expects self.theyLiveCss / self.theyLiveAssign /
    self.theyLiveStyleDecl.

    Each affirmation is painted as an SVG whose viewBox tightly bounds the
    (optionally two-line) text, then drawn with `background-size: contain`, so
    it scales to fit any ad slot — wide leaderboard or narrow skyscraper —
    without ever overflowing. Sizing the text to the viewport instead of the
    tile is what made small slots clip; don't reintroduce viewport units here.

*/

(function uBOL_theyLive() {

const PHRASES = [
    'PERFECT PHYSIQUE',
    '$10,000,000',
    'YOU ARE A BEAUTIFUL WOMAN',
    'WHAT IF IT\'S EASY?',
    'IT\'S ALREADY YOURS',
    'ACT AS IF',
    'EVERYTHING WORKS OUT FOR ME',
    'ABUNDANCE',
    'MONEY LOVES ME',
    'THE UNIVERSE IS LISTENING',
    'SPEAK IT INTO EXISTENCE',
    'MAIN CHARACTER ENERGY',
    'YOU ARE MAGNETIC',
    'IT IS DONE',
    'DREAM JOB INCOMING',
    'SOFT LIFE',
    'FIRST CLASS ONLY',
    'GLOW UP',
    'HIGH VIBRATIONS ONLY',
    'REJECTION IS REDIRECTION',
    'GRATEFUL IN ADVANCE',
    'BORN TO WIN',
    'WEALTH FINDS ME',
    'ASSUME SUCCESS',
    'YOU WOKE UP LUCKY',
    'RECEIVE',
    'BELIEVE HARDER',
    'YOUR FUTURE SELF THANKS YOU',
    'NOTHING IS OUT OF REACH',
    'I AM THE PRIZE',
];

const ATTR = 'data-ubol-they-live';

const randomPhrase = () => PHRASES[Math.floor(Math.random() * PHRASES.length)];

// ---- Phrase → self-bounding SVG billboard ---------------------------------
//
// theyLiveSvgUrl() is duplicated verbatim as an inline fallback in
// css-procedural-api.js (which is sometimes injected without this global).
// Change both together.

const theyLiveSvgUrl = (() => {
    const xmlEsc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Break a phrase onto at most two balanced lines so longer affirmations
    // use the tile's height instead of shrinking to a thin single line.
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
    return (phrase) => {
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
            `font-size='${fontSize}' letter-spacing='1' fill='black'>${xmlEsc(ln)}</text>`
        ).join('');
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}'>${texts}</svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    };
})();

const MASK_BLOCK = `{
    position: relative !important;
    display: block !important;
    min-height: 60px !important;
    background: #fff !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    border: 2px solid #000 !important;
    isolation: isolate !important;
}`;

// Common overlay box; the per-phrase rules below add the fitted SVG image.
const OVERLAY_BASE = `
    content: '' !important;
    position: absolute !important;
    inset: 0 !important;
    z-index: 2147483647 !important;
    background-color: #fff !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
    background-size: contain !important;
    pointer-events: none !important;`;

// One ::after rule per phrase, keyed on the data attribute theyLiveAssign sets.
// CSS can't read an attribute value into a background-image, but there are only
// ~30 phrases, so we emit them all once and let the cascade pick the match.
let overlayRulesEmitted = false;
const overlayRules = () => {
    const base = `[${ATTR}]::after {${OVERLAY_BASE}\n}`;
    const perPhrase = PHRASES.map(p =>
        `[${ATTR}="${p}"]::after { background-image: url("${theyLiveSvgUrl(p)}") !important; }`
    ).join('\n');
    return `${base}\n${perPhrase}\n`;
};

self.theyLiveCss = function(selectorList) {
    if ( typeof selectorList !== 'string' || selectorList === '' ) { return ''; }
    const selectors = selectorList
        .split(',\n')
        .map(s => s.trim())
        .filter(s => s !== '');
    if ( selectors.length === 0 ) { return ''; }

    const maskRule = `${selectors.join(',\n')} ${MASK_BLOCK}`;
    if ( overlayRulesEmitted ) { return `${maskRule}\n`; }
    overlayRulesEmitted = true;
    return `${maskRule}\n${overlayRules()}`;
};

// Accumulate every selector we've ever been asked to tag. A single
// MutationObserver re-runs assignment when the DOM changes, so late-loaded ad
// containers get tagged the moment they appear (css-specific.js runs once at
// document_idle and would otherwise miss them).
const knownSelectors = new Set();
let mo;
let pendingTag = false;

const tagAll = () => {
    pendingTag = false;
    for ( const selector of knownSelectors ) {
        let matched;
        try {
            matched = document.querySelectorAll(selector);
        } catch {
            continue;
        }
        for ( const el of matched ) {
            if ( el.hasAttribute(ATTR) ) { continue; }
            el.setAttribute(ATTR, randomPhrase());
        }
    }
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

// Procedural CSS pipeline can't emit pseudo-elements (it applies styles via
// `[token]{...}` rules), so we paint the fitted SVG straight onto the element
// as a background. `seed` makes the phrase deterministic per selector;
// otherwise we pick once at module-load time so a single page is consistent.
const hashStr = (s) => {
    let h = 0;
    for ( let i = 0; i < s.length; i++ ) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
};

const defaultProceduralPhrase = randomPhrase();

self.theyLiveStyleDecl = function(seed) {
    const phrase = seed
        ? PHRASES[hashStr(seed) % PHRASES.length]
        : defaultProceduralPhrase;
    return [
        'background-color:#fff !important',
        `background-image:url("${theyLiveSvgUrl(phrase)}") !important`,
        'background-repeat:no-repeat !important',
        'background-position:center !important',
        'background-size:contain !important',
        'min-height:60px !important',
        'border:2px solid #000 !important',
        'color:transparent !important',
        'display:block !important',
    ].join(';') + ';';
};

})();

void 0;
