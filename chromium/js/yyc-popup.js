// Yes You Can Adblocker — fork actions added to uBOL's toolbar popup.
// uBOL's own popup.js is left untouched; this only wires the two fork buttons.

function on(id, fn) {
    const el = document.getElementById(id);
    if ( el === null ) { return; }
    el.addEventListener('click', fn);
    el.addEventListener('keydown', e => {
        if ( e.key === 'Enter' || e.key === ' ' ) { e.preventDefault(); fn(); }
    });
}

on('yycCustomize', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('affirmations.html') });
    window.close();
});

on('yycReroll', async () => {
    try {
        const [ tab ] = await chrome.tabs.query({ active: true, currentWindow: true });
        if ( tab && tab.id ) {
            chrome.tabs.sendMessage(tab.id, { cmd: 'yyc-reroll' }, () => void chrome.runtime.lastError);
        }
    } catch {}
    window.close();
});
