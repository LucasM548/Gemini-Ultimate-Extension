// DEFAULT_CONFIG is loaded from config.js

// Load config from storage or use default
async function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['config'], (result) => {
            resolve(result.config || DEFAULT_CONFIG);
        });
    });
}

const params = new URLSearchParams(window.location.search);
const query = params.get('q');

// --- UTILITIES ---

function findClickableByText(text) {
    if (!text) return null;
    const textLower = text.toLowerCase();
    const xpath = `//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${textLower}') or contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${textLower}')]`;

    const snapshot = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

    for (let i = 0; i < snapshot.snapshotLength; i++) {
        let el = snapshot.snapshotItem(i);
        let current = el;
        while (current && current.tagName !== 'BODY') {
            const style = window.getComputedStyle(current);
            if (style.display === 'none' || style.visibility === 'hidden') {
                break;
            }

            const role = current.getAttribute('role');
            const tagName = current.tagName;

            if (tagName === 'BUTTON' || role === 'button' || role === 'menuitem') {
                return current;
            }
            current = current.parentElement;
        }
    }
    return null;
}

function waitForSelector(selector) {
    return new Promise(resolve => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) { resolve(el); observer.disconnect(); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

// --- MAIN LOGIC ---

async function runScript() {
    if (!query) return;

    const config = await getConfig();
    console.log("Gemini Ultimate: Config loaded", config);

    // 1. Wait for load
    await waitForSelector('div[contenteditable="true"]');
    await new Promise(r => setTimeout(r, 800));

    // 2. Check current model
    let activeSwitchBtn = null;
    let foundBadKeyword = false;

    for (const badKeyword of config.MODELS_TO_AVOID) {
        const btn = findClickableByText(badKeyword);
        if (btn) {
            console.log(`Gemini Ultimate: Avoid model detected: "${badKeyword}"`);
            activeSwitchBtn = btn;
            foundBadKeyword = true;
            break;
        }
    }

    // 3. Switch model
    if (foundBadKeyword && activeSwitchBtn) {
        console.log("Gemini Ultimate: Opening menu...");
        activeSwitchBtn.click();
        await new Promise(r => setTimeout(r, config.DELAY_MENU_OPEN));

        let targetClicked = false;
        for (const targetName of config.TARGET_MODELS) {
            const targetOption = findClickableByText(targetName);
            if (targetOption) {
                console.log(`Gemini Ultimate: Switching to: ${targetName}`);
                targetOption.click();
                targetClicked = true;
                await new Promise(r => setTimeout(r, config.DELAY_PAGE_LOAD));
                break;
            }
        }

        if (!targetClicked) {
            console.warn("Gemini Ultimate: No target model found!");
        }
    }

    // 4. Fill and Send
    const editor = await waitForSelector('div[contenteditable="true"]');

    editor.focus();
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, query);

    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);

    // Send
    setTimeout(() => {
        const sendButton = document.querySelector('button[aria-label="Envoyer"], button[aria-label="Send"], button[aria-label*="message"]');
        if (sendButton && !sendButton.disabled) {
            sendButton.click();
        } else {
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => sendButton?.click(), 200);
        }
    }, config.DELAY_BEFORE_SEND);
}

runScript();
