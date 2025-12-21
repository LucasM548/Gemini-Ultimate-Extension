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

// --- NOTIFICATION SYSTEM ---

function showNotification(message, type = 'error') {
    const existing = document.getElementById('gemini-ultimate-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'gemini-ultimate-notification';

    const colors = {
        info: { bg: 'rgba(138, 180, 248, 0.95)', text: '#000' },
        success: { bg: 'rgba(129, 201, 149, 0.95)', text: '#000' },
        warning: { bg: 'rgba(251, 188, 4, 0.95)', text: '#000' },
        error: { bg: 'rgba(242, 139, 130, 0.95)', text: '#000' }
    };

    const color = colors[type] || colors.error;

    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        background: ${color.bg};
        color: ${color.text};
        border-radius: 12px;
        font-family: 'Google Sans', 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideUp 0.3s ease;
        backdrop-filter: blur(10px);
    `;

    const style = document.createElement('style');
    style.id = 'gemini-ultimate-style';
    if (!document.getElementById('gemini-ultimate-style')) {
        style.textContent = `
            @keyframes slideUp {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
            @keyframes slideDown {
                from { opacity: 1; transform: translateX(-50%) translateY(0); }
                to { opacity: 0; transform: translateX(-50%) translateY(20px); }
            }
        `;
        document.head.appendChild(style);
    }

    notification.innerHTML = `<span>⚠️ ${message}</span>`;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideDown 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// --- UTILITIES ---

// Find the model selector pill (the clickable element showing current model)
function findModelSelectorPill() {
    return document.querySelector('.logo-pill-label-container, .input-area-switch-label, [class*="model-selector"]');
}

// Check if the current model contains any of the keywords
function currentModelContains(keywords) {
    const pill = findModelSelectorPill();
    if (!pill) return null;

    const text = (pill.textContent || '').toLowerCase().trim();

    for (const keyword of keywords) {
        const kw = keyword.toLowerCase().trim();
        if (text.includes(kw)) {
            return { element: pill, keyword: keyword };
        }
    }

    return null;
}

// Find a menu item by keyword - uses Gemini's specific structure
function findMenuItem(keywords) {
    for (const keyword of keywords) {
        const kw = keyword.toLowerCase().trim();

        // Method 1: Use data-test-id attribute (most reliable)
        // Gemini uses: bard-mode-option-fast, bard-mode-option-thinking, bard-mode-option-pro
        const testIdButton = document.querySelector(`button[data-test-id*="${kw}" i]`);
        if (testIdButton) {
            return { element: testIdButton, keyword: keyword };
        }

        // Method 2: Find by .mode-title text content
        const modeTitles = document.querySelectorAll('.mode-title, .gds-label-l');
        for (const title of modeTitles) {
            const titleText = (title.textContent || '').toLowerCase().trim();
            if (titleText.includes(kw)) {
                // Find the parent button
                const button = title.closest('button, [role="menuitemradio"], [role="menuitem"]');
                if (button) {
                    return { element: button, keyword: keyword };
                }
            }
        }

        // Method 3: Search all menu buttons
        const menuButtons = document.querySelectorAll('button[role="menuitemradio"], button.bard-mode-list-button');
        for (const btn of menuButtons) {
            const btnText = (btn.textContent || '').toLowerCase();
            if (btnText.includes(kw)) {
                return { element: btn, keyword: keyword };
            }
        }
    }

    return null;
}

function waitForSelector(selector, timeout = 10000) {
    return new Promise((resolve) => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                resolve(el);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}

function waitForMenu(timeout = 2000) {
    return new Promise((resolve) => {
        const checkMenu = () => {
            // Look for Gemini's menu container
            return document.querySelector('.menu-inner-container, [role="menu"], .mat-mdc-menu-panel');
        };

        const menu = checkMenu();
        if (menu) return resolve(menu);

        const observer = new MutationObserver(() => {
            const menu = checkMenu();
            if (menu) {
                resolve(menu);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            resolve(checkMenu());
        }, timeout);
    });
}

// --- MAIN LOGIC ---

async function runScript() {
    if (!query) return;

    const config = await getConfig();

    // 1. Wait for page load
    await waitForSelector('div[contenteditable="true"]');
    await new Promise(r => setTimeout(r, 1000));

    // 2. Check if current model should be avoided
    const badModel = currentModelContains(config.MODELS_TO_AVOID);

    // 3. Switch model if needed
    if (badModel) {
        // Click on the model selector pill to open menu
        badModel.element.click();

        // Wait for menu to appear
        await waitForMenu();
        await new Promise(r => setTimeout(r, config.DELAY_MENU_OPEN + 300));

        // Find and click target model in the menu
        const targetModel = findMenuItem(config.TARGET_MODELS);

        if (targetModel) {
            targetModel.element.click();
            await new Promise(r => setTimeout(r, config.DELAY_PAGE_LOAD));
        } else {
            showNotification('Aucun modèle cible trouvé!', 'error');
            // Close menu by pressing Escape
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }
    }

    // 4. Fill and Send
    const editor = await waitForSelector('div[contenteditable="true"]');
    if (!editor) return;

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
