// Yes You Can Adblocker — control panel logic.
// Reads/writes chrome.storage.sync key `yyc_settings` (packs, custom, theme)
// and reads chrome.storage.local key `yyc_count` (lifetime tile counter).
// Display metadata is mirrored from they-live.js; the phrase lists themselves
// live in the content script.

const THEMES = {
    classic: { name: 'Classic', tile: '#ffffff', border: '#000000', ink: '#000000' },
    soft:    { name: 'Soft',    tile: '#fff5f7', border: '#ff9ec4', ink: '#d1477a' },
    noir:    { name: 'Noir',    tile: '#0b0b0b', border: '#ffffff', ink: '#ffffff' },
    gold:    { name: 'Gold',    tile: '#0b0b0b', border: '#d4af37', ink: '#d4af37' },
    vapor:   { name: 'Vapor',   tile: '#1a0b2e', border: '#36e0ff', ink: '#ff6ad5' },
};

const PACKS = {
    wealth:     { name: 'Wealth',     samples: ['MONEY LOVES ME', '$10,000,000', 'WEALTH FINDS ME', 'FIRST CLASS ONLY'] },
    beauty:     { name: 'Beauty',     samples: ['SOFT LIFE', 'GLOW UP', 'YOU ARE MAGNETIC', 'HIGH VIBRATIONS ONLY'] },
    confidence: { name: 'Confidence', samples: ['MAIN CHARACTER ENERGY', 'ACT AS IF', 'I AM THE PRIZE', 'BORN TO WIN'] },
    calm:       { name: 'Calm',       samples: ['IT IS DONE', 'WHAT IF IT\'S EASY?', 'THE UNIVERSE IS LISTENING'] },
    career:     { name: 'Career',     samples: ['DREAM JOB INCOMING', 'SPEAK IT INTO EXISTENCE', 'YOUR FUTURE SELF THANKS YOU'] },
    petty:      { name: 'Petty',      samples: ['UNBOTHERED', 'I AM THAT GIRL', 'PLOT TWIST: I WIN', 'BLOCK AND THRIVE'] },
};

const DEFAULTS = {
    packs: { wealth: true, beauty: true, confidence: true, calm: true, career: true, petty: false },
    custom: [],
    theme: 'classic',
};

let settings = structuredClone(DEFAULTS);

const $ = id => document.getElementById(id);
const hasStorage = () => typeof chrome !== 'undefined' && chrome.storage;

// ---- Load -----------------------------------------------------------------

function mergeSettings(s) {
    if ( !s || typeof s !== 'object' ) { return; }
    settings = {
        theme: typeof s.theme === 'string' && THEMES[s.theme] ? s.theme : DEFAULTS.theme,
        custom: Array.isArray(s.custom) ? s.custom.filter(x => typeof x === 'string') : [],
        packs: { ...DEFAULTS.packs, ...(s.packs && typeof s.packs === 'object' ? s.packs : {}) },
    };
}

function load() {
    if ( !hasStorage() ) { renderAll(); return; }
    chrome.storage.sync.get('yyc_settings', d => {
        if ( !chrome.runtime.lastError && d && d.yyc_settings ) { mergeSettings(d.yyc_settings); }
        renderAll();
    });
    chrome.storage.local.get('yyc_count', d => {
        if ( !chrome.runtime.lastError ) { setCount((d && d.yyc_count) || 0); }
    });
    if ( chrome.storage.onChanged ) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if ( area === 'local' && changes.yyc_count ) { setCount(changes.yyc_count.newValue || 0); }
        });
    }
}

// ---- Save (debounced) -----------------------------------------------------

let saveTimer;
function save() {
    if ( !hasStorage() ) { return; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        chrome.storage.sync.set({ yyc_settings: settings }, () => {
            if ( chrome.runtime.lastError ) {
                // sync quota or unavailable — fall back to local so it still applies.
                chrome.storage.local.set({ yyc_settings: settings });
            }
            flashStatus();
        });
    }, 400);
}

// ---- Render ---------------------------------------------------------------

function setCount(n) {
    $('count').textContent = Number(n || 0).toLocaleString();
}

function renderAll() {
    renderThemes();
    renderPacks();
    $('custom').value = settings.custom.join('\n');
    updatePreview();
}

function renderThemes() {
    const wrap = $('themes');
    wrap.textContent = '';
    for ( const [key, t] of Object.entries(THEMES) ) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'theme' + (settings.theme === key ? ' sel' : '');
        const sw = document.createElement('div');
        sw.className = 'swatch';
        sw.style.background = t.tile;
        sw.style.border = `3px solid ${t.border}`;
        sw.style.color = t.ink;
        sw.textContent = 'A';
        const nm = document.createElement('span');
        nm.className = 'name';
        nm.textContent = t.name;
        el.append(sw, nm);
        el.addEventListener('click', () => {
            settings.theme = key;
            renderThemes();
            updatePreview();
            save();
        });
        wrap.appendChild(el);
    }
}

function renderPacks() {
    const wrap = $('packs');
    wrap.textContent = '';
    for ( const [key, p] of Object.entries(PACKS) ) {
        const on = settings.packs[key] === true;
        const el = document.createElement('div');
        el.className = 'pack' + (on ? ' on' : '');
        el.setAttribute('role', 'checkbox');
        el.setAttribute('aria-checked', String(on));
        el.tabIndex = 0;
        const box = document.createElement('span');
        box.className = 'box';
        box.textContent = on ? '✓' : '';
        const meta = document.createElement('span');
        meta.className = 'meta';
        const b = document.createElement('b');
        b.textContent = p.name;
        const small = document.createElement('small');
        small.textContent = p.samples[0];
        meta.append(b, small);
        el.append(box, meta);
        const toggle = () => {
            settings.packs[key] = settings.packs[key] !== true;
            renderPacks();
            updatePreview();
            save();
        };
        el.addEventListener('click', toggle);
        el.addEventListener('keydown', e => {
            if ( e.key === ' ' || e.key === 'Enter' ) { e.preventDefault(); toggle(); }
        });
        wrap.appendChild(el);
    }
}

function activeSamples() {
    const out = [];
    for ( const [key, p] of Object.entries(PACKS) ) {
        if ( settings.packs[key] ) { out.push(...p.samples); }
    }
    out.push(...settings.custom.map(s => s.trim()).filter(Boolean));
    return out.length ? out : PACKS.wealth.samples;
}

let previewTimer;
function updatePreview() {
    const t = THEMES[settings.theme] || THEMES.classic;
    const tile = $('preview');
    tile.style.background = t.tile;
    tile.style.borderColor = t.border;
    $('previewText').style.color = t.ink;
    rotatePreview();
    clearInterval(previewTimer);
    previewTimer = setInterval(rotatePreview, 2600);
}
function rotatePreview() {
    const samples = activeSamples();
    $('previewText').textContent = samples[Math.floor(Math.random() * samples.length)];
}

// ---- Custom textarea ------------------------------------------------------

$('custom').addEventListener('input', () => {
    settings.custom = $('custom').value
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 100);
    updatePreview();
    save();
});

// ---- Re-roll (broadcast to every open tab) --------------------------------

$('reroll').addEventListener('click', () => {
    if ( typeof chrome === 'undefined' || !chrome.tabs ) { return; }
    chrome.tabs.query({}, tabs => {
        for ( const tab of tabs ) {
            if ( !tab.id || !/^https?:/.test(tab.url || '') ) { continue; }
            chrome.tabs.sendMessage(tab.id, { cmd: 'yyc-reroll' }, () => void chrome.runtime.lastError);
        }
    });
    const btn = $('reroll');
    const original = btn.textContent;
    btn.textContent = '✨ Re-rolled!';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1200);
});

// ---- Status ---------------------------------------------------------------

let statusTimer;
function flashStatus() {
    const s = $('status');
    s.classList.add('show');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => s.classList.remove('show'), 1400);
}

load();
