// DEFAULT_CONFIG is loaded from config.js
// Gemini Ultimate v2.1 — Styled debug logs + config-driven toggle

// ─── LOGGER ──────────────────────────────────────────────────────────────────

let DEBUG = false; // Will be set from config

const STYLES = {
    title:  'color:#fff;background:#6C5CE7;padding:2px 6px;border-radius:4px;font-weight:bold',
    step:   'color:#fff;background:#00B894;padding:2px 6px;border-radius:4px;font-weight:bold',
    info:   'color:#74b9ff;font-weight:normal',
    warn:   'color:#fdcb6e;font-weight:bold',
    error:  'color:#ff7675;font-weight:bold',
    data:   'color:#dfe6e9;font-weight:normal',
    match:  'color:#55efc4;font-weight:bold',
};

function log(style, ...args) {
    if (!DEBUG) return;
    console.log('%c🔮 Gemini Ultimate %c' + args[0], STYLES.title, style, ...args.slice(1));
}
function logStep(step, ...args) {
    if (!DEBUG) return;
    console.log('%c🔮 Gemini Ultimate %c▸ ' + step, STYLES.title, STYLES.step, ...args);
}
function logWarn(...args) {
    if (!DEBUG) return;
    console.warn('%c🔮 Gemini Ultimate %c⚠ ' + args[0], STYLES.title, STYLES.warn, ...args.slice(1));
}

// ─── CONFIG ──────────────────────────────────────────────────────────────────

async function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['config'], (result) => {
            const config = result.config || DEFAULT_CONFIG;
            // Migration: ensure "Extended" is in MODELS_TO_AVOID for users
            // who upgraded from v1.x with a saved config
            if (config.MODELS_TO_AVOID && !config.MODELS_TO_AVOID.includes('Extended')) {
                config.MODELS_TO_AVOID.push('Extended');
                chrome.storage.sync.set({ config });
            }
            // Set global debug flag
            DEBUG = config.DEBUG_LOGS === true;
            resolve(config);
        });
    });
}

const params = new URLSearchParams(window.location.search);
const query  = params.get('q');

// ─── NOTIFICATION ─────────────────────────────────────────────────────────────

function showNotification(message, type = 'error') {
    const existing = document.getElementById('gemini-ultimate-notification');
    if (existing) existing.remove();

    if (!document.getElementById('gemini-ultimate-style')) {
        const style = document.createElement('style');
        style.id = 'gemini-ultimate-style';
        style.textContent = `
            @keyframes guSlideUp {
                from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                to   { opacity: 1; transform: translateX(-50%) translateY(0);    }
            }
            @keyframes guSlideDown {
                from { opacity: 1; transform: translateX(-50%) translateY(0);    }
                to   { opacity: 0; transform: translateX(-50%) translateY(20px); }
            }
        `;
        document.head.appendChild(style);
    }

    const colors = {
        info:    { bg: 'rgba(138, 180, 248, 0.95)', text: '#000' },
        success: { bg: 'rgba(129, 201, 149, 0.95)', text: '#000' },
        warning: { bg: 'rgba(251, 188, 4,   0.95)', text: '#000' },
        error:   { bg: 'rgba(242, 139, 130, 0.95)', text: '#000' },
    };
    const color = colors[type] || colors.error;

    const notifEl = document.createElement('div');
    notifEl.id = 'gemini-ultimate-notification';
    notifEl.style.cssText = `
        position:fixed; bottom:20px; left:50%;
        transform:translateX(-50%);
        padding:12px 24px;
        background:${color.bg}; color:${color.text};
        border-radius:12px;
        font-family:'Google Sans','Segoe UI',Roboto,sans-serif;
        font-size:14px; font-weight:500;
        box-shadow:0 4px 12px rgba(0,0,0,.3);
        z-index:999999; display:flex; align-items:center; gap:10px;
        animation:guSlideUp .3s ease; backdrop-filter:blur(10px);
    `;
    const span = document.createElement('span');
    span.textContent = `⚠️ ${message}`;
    notifEl.appendChild(span);
    document.body.appendChild(notifEl);

    setTimeout(() => {
        notifEl.style.animation = 'guSlideDown .3s ease forwards';
        setTimeout(() => notifEl.remove(), 300);
    }, 4000);
}

// ─── MODEL PICKER ─────────────────────────────────────────────────────────────

function getPickerFullText(pillElement) {
    const primary   = pillElement.querySelector('.picker-primary-text');
    const secondary = pillElement.querySelector('.picker-secondary-text');
    if (primary) {
        const parts = [primary.textContent.trim()];
        if (secondary) parts.push(secondary.textContent.trim());
        return parts.join(' ');
    }

    const ariaLabel = pillElement.getAttribute('aria-label') || '';
    const currentlyMatch = ariaLabel.match(/currently\s+(.+)/i);
    if (currentlyMatch) return currentlyMatch[1].trim();

    const labelContainer = pillElement.querySelector(
        '.logo-pill-label-container, .input-area-switch-label'
    );
    if (labelContainer) {
        let text = '';
        for (const child of labelContainer.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                text += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                const tag = child.tagName.toLowerCase();
                if (tag !== 'gem-icon' && tag !== 'mat-icon') {
                    text += child.textContent;
                }
            }
        }
        return text.trim();
    }

    return (pillElement.textContent || '').trim();
}

function findModelSelectorPill() {
    const stableSelectors = [
        '[data-test-id="bard-mode-menu-button"]',
        '[data-test-id="model-picker-trigger"]',
        '[data-test-id="model-selector-trigger"]',
        '[data-test-id="model-chip"]',
        'button[data-test-id*="model"]',
        'model-selector-chip button',
        'model-picker button',
    ];
    for (const sel of stableSelectors) {
        const el = document.querySelector(sel);
        if (el && el.getClientRects().length > 0) {
            log(STYLES.info, `Pill found via ${sel}`);
            return el;
        }
    }

    const modeSwitcher = document.querySelector('bard-mode-switcher');
    if (modeSwitcher) {
        const btn = modeSwitcher.querySelector('button');
        if (btn && btn.getClientRects().length > 0) {
            log(STYLES.info, 'Pill found via bard-mode-switcher');
            return btn;
        }
    }

    const headerContainers = document.querySelectorAll(
        'header, [role="banner"], nav, .app-header, [class*="header"], [class*="top-bar"]'
    );
    const MODEL_KW = ['flash', 'thinking', 'pro', 'ultra', 'nano', 'lite', 'extended'];
    for (const container of headerContainers) {
        const btns = container.querySelectorAll('button, [role="button"], [role="combobox"]');
        for (const btn of btns) {
            if (btn.getClientRects().length === 0) continue;
            const text = (btn.textContent + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase();
            if (MODEL_KW.some(k => text.includes(k)) && text.length < 80) {
                log(STYLES.info, 'Pill found via header keyword');
                return btn;
            }
        }
    }

    const legacySelectors = [
        'button.input-area-switch',
        '.model-picker-container button',
        '.logo-pill-label-container',
        '.input-area-switch-label',
        '[class*="model-selector"] button',
        '[class*="model-chip"]',
        'button[aria-label*="mode picker"]',
        'button[aria-label*="Flash"]',
        'button[aria-label*="flash"]',
        'button[aria-label*="modèle"]',
        'button[aria-label*="model"]',
    ];
    for (const sel of legacySelectors) {
        const el = document.querySelector(sel);
        if (el && el.getClientRects().length > 0) {
            log(STYLES.info, `Pill found via legacy: ${sel}`);
            if (el.tagName !== 'BUTTON') {
                const btn = el.closest('button') || el.querySelector('button');
                if (btn && btn.getClientRects().length > 0) return btn;
            }
            return el;
        }
    }

    const allButtons = document.querySelectorAll('button, [role="button"]');
    for (const btn of allButtons) {
        if (btn.getClientRects().length === 0) continue;
        if (btn.closest('[role="dialog"], [role="alertdialog"]')) continue;
        const text = (btn.textContent + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase().trim();
        if (MODEL_KW.some(k => text.includes(k)) && text.length < 60) {
            log(STYLES.info, 'Pill found via fallback button');
            return btn;
        }
    }

    return null;
}

function currentModelContains(keywords) {
    const pill = findModelSelectorPill();
    if (!pill) {
        logWarn('No pill element found');
        return null;
    }
    const text = getPickerFullText(pill).toLowerCase();
    log(STYLES.data, `Current model: "${text}"`);
    for (const kw of keywords) {
        if (text.includes(kw.toLowerCase().trim())) {
            log(STYLES.match, `Match: "${kw}" → switching model`);
            return { element: pill, keyword: kw };
        }
    }
    log(STYLES.info, 'Model is OK, no change needed');
    return null;
}

// ─── MENU ITEMS ───────────────────────────────────────────────────────────────

function getMenuItemLabel(menuItem) {
    const labelSpan = menuItem.querySelector('.label');
    if (labelSpan) return labelSpan.textContent.trim();
    const titleEl = menuItem.querySelector(
        '.mode-title, [class*="model-name"], [class*="model-title"], [class*="option-title"]'
    );
    if (titleEl) return titleEl.textContent.trim();
    return (menuItem.textContent || '').trim();
}

function findMenuItem(keywords) {
    const allGemItems = document.querySelectorAll('gem-menu-item');
    if (DEBUG && allGemItems.length > 0) {
        const labels = Array.from(allGemItems).map(item => getMenuItemLabel(item));
        log(STYLES.data, `Menu items: [${labels.join(', ')}]`);
    }

    for (const keyword of keywords) {
        const kw = keyword.toLowerCase().trim();

        for (const item of allGemItems) {
            if (item.getClientRects().length === 0) continue;
            const label = getMenuItemLabel(item).toLowerCase();
            if (matchesModelKeyword(label, kw)) {
                log(STYLES.match, `Menu match: "${label}" for keyword "${kw}"`);
                return { element: item, keyword };
            }
        }

        const escapedKw = CSS.escape(kw);
        const byId = document.querySelector(
            `[data-test-id*="${escapedKw}" i], button[data-test-id*="${escapedKw}" i]`
        );
        if (byId && byId.getClientRects().length > 0) return { element: byId, keyword };

        const labelEls = document.querySelectorAll(
            '.mode-title, .gds-label-l, .label, '
            + '[class*="option-title"], [class*="model-name"], [class*="model-title"], '
            + 'mat-option span, [role="option"] span, '
            + '[role="menuitem"] span, [role="menuitemradio"] span, '
            + 'li span, [class*="list-item"] span'
        );
        for (const el of labelEls) {
            const elText = (el.textContent || '').toLowerCase().trim();
            if (matchesModelKeyword(elText, kw)) {
                const btn = el.closest(
                    'gem-menu-item, button, [role="menuitemradio"], [role="menuitem"], [role="option"], mat-option, li'
                );
                if (btn && btn.getClientRects().length > 0) return { element: btn, keyword };
            }
        }

        const menuItems = document.querySelectorAll(
            'gem-menu-item, button[role="menuitemradio"], button[role="menuitem"], button[role="option"], '
            + 'button.bard-mode-list-button, mat-option, [role="option"], '
            + 'li[role="option"], li[role="menuitem"]'
        );
        for (const item of menuItems) {
            if (item.getClientRects().length === 0) continue;
            const label = getMenuItemLabel(item).toLowerCase();
            if (matchesModelKeyword(label, kw)) return { element: item, keyword };
        }
    }
    logWarn('No target model found in menu');
    return null;
}

function matchesModelKeyword(text, keyword) {
    if (!text.includes(keyword)) return false;
    if (keyword.includes('-') || keyword.includes(' ')) return true;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![a-z\\-])${escaped}(?!\\-[a-z])`, 'i');
    return re.test(text);
}

// ─── WAIT HELPERS ─────────────────────────────────────────────────────────────

function waitForSelector(selector, timeout = 10000) {
    return new Promise((resolve) => {
        let resolved = false;
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        const obs = new MutationObserver(() => {
            if (resolved) return;
            const found = document.querySelector(selector);
            if (found) { resolved = true; obs.disconnect(); resolve(found); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { if (!resolved) { resolved = true; obs.disconnect(); resolve(null); } }, timeout);
    });
}

function waitForMenu(timeout = 2500) {
    return new Promise((resolve) => {
        let resolved = false;
        const check = () => document.querySelector(
            'gem-menu[data-visible="true"], gem-menu, [role="menu"], [role="listbox"], '
            + '.mat-mdc-menu-panel, .menu-inner-container, '
            + 'mat-select-panel, [class*="dropdown-panel"], '
            + '[class*="model-menu"], [class*="options-list"], '
            + '[class*="picker-panel"], [class*="selector-panel"]'
        );
        const found = check();
        if (found) return resolve(found);
        const obs = new MutationObserver(() => {
            if (resolved) return;
            const f = check();
            if (f) { resolved = true; obs.disconnect(); resolve(f); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { if (!resolved) { resolved = true; obs.disconnect(); resolve(check()); } }, timeout);
    });
}

function waitForModelPicker(timeout = 8000) {
    return new Promise((resolve) => {
        let resolved = false;
        const pill = findModelSelectorPill();
        if (pill) return resolve(pill);
        log(STYLES.info, 'Waiting for model picker...');
        const obs = new MutationObserver(() => {
            if (resolved) return;
            const found = findModelSelectorPill();
            if (found) {
                resolved = true;
                obs.disconnect();
                resolve(found);
            }
        });
        obs.observe(document.body, { childList: true, subtree: true, attributes: true });
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                obs.disconnect();
                logWarn(`Model picker TIMEOUT (${timeout}ms)`);
                resolve(null);
            }
        }, timeout);
    });
}

// ─── TEXT INJECTION ───────────────────────────────────────────────────────────

function injectText(editor, text) {
    editor.focus();
    document.execCommand('selectAll', false, null);
    const ok = document.execCommand('insertText', false, text);

    if (!ok || editor.innerText.trim() !== text.trim()) {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        sel.removeAllRanges();
        sel.addRange(range);
        sel.deleteFromDocument();
        const textNode = document.createTextNode(text);
        editor.appendChild(textNode);
        range.selectNodeContents(editor);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    editor.dispatchEvent(new Event('change', { bubbles: true }));
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
}

// ─── SEND ─────────────────────────────────────────────────────────────────────

function sendMessage(editor) {
    editor.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true,
        key: 'Enter', code: 'Enter', keyCode: 13
    }));

    setTimeout(() => {
        if (editor.innerText.trim().length === 0) {
            log(STYLES.info, 'Sent via Enter key');
            return;
        }
        log(STYLES.info, 'Enter failed, trying send button...');
        const btn = document.querySelector(
            'button[aria-label="Envoyer un message"], '
            + 'button[aria-label="Envoyer le message"], '
            + 'button[aria-label="Envoyer"], '
            + 'button[aria-label="Send message"], '
            + 'button[aria-label="Send"], '
            + 'button[data-test-id="send-button"], '
            + 'button[jsname="vSSGHe"], '
            + 'button[class*="send-button"], '
            + 'button.submit, '
            + '[data-test-id="send-btn"]'
        );
        if (btn && !btn.disabled && btn.getClientRects().length > 0) btn.click();
        else logWarn('No send button found');
    }, 500);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function runScript() {
    if (!query) return;

    const config = await getConfig();
    logStep('START', `query="${query.substring(0, 40)}..."`);
    log(STYLES.data, 'Config:', JSON.stringify(config, null, 0));

    // 1. Wait for editor
    logStep('Step 1', 'Waiting for editor...');
    const editorReady = await waitForSelector('div[contenteditable="true"]');
    if (!editorReady) { logWarn('Editor not found — aborting'); return; }
    log(STYLES.info, 'Editor ready ✓');

    // 2. Wait for model picker
    logStep('Step 2', 'Waiting for model picker...');
    const pickerPill = await waitForModelPicker(8000);
    if (!pickerPill) logWarn('Model picker not found — skipping model switch');
    await new Promise(r => setTimeout(r, 300));

    // 3. Check & switch model
    if (pickerPill) {
        logStep('Step 3', 'Checking current model...');
        const badModel = currentModelContains(config.MODELS_TO_AVOID);

        if (badModel) {
            badModel.element.click();
            log(STYLES.info, 'Waiting for menu...');
            const menu = await waitForMenu();
            await new Promise(r => setTimeout(r, menu
                ? Math.min(config.DELAY_MENU_OPEN, 400)
                : config.DELAY_MENU_OPEN
            ));

            const targetModel = findMenuItem(config.TARGET_MODELS);
            if (targetModel) {
                targetModel.element.click();
                await new Promise(r => setTimeout(r, config.DELAY_PAGE_LOAD));
                log(STYLES.match, `Switched to ${targetModel.keyword} ✓`);
            } else {
                showNotification('Aucun modèle cible trouvé dans le menu', 'warning');
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            }
        }
    }

    // 4. Inject text
    logStep('Step 4', 'Injecting text...');
    const editor = document.querySelector('div[contenteditable="true"]');
    if (!editor) { logWarn('Editor disappeared'); return; }
    injectText(editor, query);

    const cleanParams = new URLSearchParams(window.location.search);
    cleanParams.delete('q');
    const cleanSearch = cleanParams.toString();
    const cleanUrl = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '');
    window.history.replaceState({}, document.title, cleanUrl);

    // 5. Send
    logStep('Step 5', `Sending in ${config.DELAY_BEFORE_SEND}ms...`);
    setTimeout(() => sendMessage(editor), config.DELAY_BEFORE_SEND);
}

runScript();
