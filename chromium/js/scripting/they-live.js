/*******************************************************************************

    "Yes You Can" fork — replaces cosmetically-hidden ad elements with a
    white billboard tile bearing a motivational / manifestation affirmation.

    Mechanic inherited from the They Live adblocker fork of uBO Lite:
    https://github.com/davmlaw/they_live_adblocker

    This file MUST run before css-specific.js, css-generic.js, and any other
    consumer that expects self.theyLiveCss / self.theyLiveAssign /
    self.theyLiveStyleDecl.

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

// Styles common to every ::after overlay. Content comes from the data
// attribute set by theyLiveAssign.
const AFTER_STYLE = `
    position: absolute !important;
    inset: 0 !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: #fff !important;
    color: #000 !important;
    font-family: 'Impact', 'Arial Black', 'Helvetica Neue', sans-serif !important;
    font-weight: 900 !important;
    font-size: clamp(18px, 4vw, 64px) !important;
    line-height: 1.1 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.08em !important;
    text-align: center !important;
    padding: 8px !important;
    box-sizing: border-box !important;
    pointer-events: none !important;`;

self.theyLiveCss = function(selectorList) {
    if ( typeof selectorList !== 'string' || selectorList === '' ) { return ''; }
    const selectors = selectorList
        .split(',\n')
        .map(s => s.trim())
        .filter(s => s !== '');
    if ( selectors.length === 0 ) { return ''; }

    const maskRule = `${selectors.join(',\n')} ${MASK_BLOCK}`;
    const afterSelectors = selectors.map(s => `${s}::after`).join(',\n');
    const afterRule = `${afterSelectors} {
    content: attr(${ATTR});${AFTER_STYLE}
}`;
    return `${maskRule}\n${afterRule}\n`;
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
// `[token]{...}` rules), so we render the phrase as an inline-SVG
// background-image. `seed` lets call sites vary by selector; otherwise we
// pick once at module-load time so a single page is consistent.
const buildSvgUrl = (phrase) => {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 100' preserveAspectRatio='xMidYMid meet'>" +
        "<rect width='100%' height='100%' fill='white'/>" +
        "<text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' " +
        "font-family='Impact,Arial Black,sans-serif' font-weight='900' font-size='56' " +
        `letter-spacing='4' fill='black'>${phrase}</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};

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
        `background-image:${buildSvgUrl(phrase)} !important`,
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
