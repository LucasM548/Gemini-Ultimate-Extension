// DEFAULT_CONFIG is loaded from config.js

// State
let config = { ...DEFAULT_CONFIG };
let saveTimeout;

// DOM Elements
const els = {
    targetList: document.getElementById('targetList'),
    avoidList: document.getElementById('avoidList'),
    newTarget: document.getElementById('newTarget'),
    newAvoid: document.getElementById('newAvoid'),
    addTargetBtn: document.getElementById('addTargetBtn'),
    addAvoidBtn: document.getElementById('addAvoidBtn'),
    delayMenu: document.getElementById('delayMenu'),
    delayPage: document.getElementById('delayPage'),
    delaySend: document.getElementById('delaySend'),
    saveIndicator: document.getElementById('saveIndicator')
};

// Auto-save with debounce
function saveConfig() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        config.DELAY_MENU_OPEN = parseInt(els.delayMenu.value) || 50;
        config.DELAY_PAGE_LOAD = parseInt(els.delayPage.value) || 50;
        config.DELAY_BEFORE_SEND = parseInt(els.delaySend.value) || 50;

        chrome.storage.sync.set({ config }, () => {
            showSaveIndicator();
        });
    }, 300);
}

// Show save indicator animation
function showSaveIndicator() {
    els.saveIndicator.classList.add('visible');
    setTimeout(() => {
        els.saveIndicator.classList.remove('visible');
    }, 1500);
}

// Render Functions
function renderTags(container, list, onRemove) {
    container.innerHTML = '';
    list.forEach((item, index) => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.innerHTML = `
            <span>${item}</span>
            <span class="remove" title="Remove">
                <svg viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </span>
        `;
        tag.querySelector('.remove').addEventListener('click', () => {
            onRemove(index);
        });
        container.appendChild(tag);
    });
}

function updateUI() {
    renderTags(els.targetList, config.TARGET_MODELS, (index) => {
        config.TARGET_MODELS.splice(index, 1);
        updateUI();
        saveConfig();
    });

    renderTags(els.avoidList, config.MODELS_TO_AVOID, (index) => {
        config.MODELS_TO_AVOID.splice(index, 1);
        updateUI();
        saveConfig();
    });

    els.delayMenu.value = config.DELAY_MENU_OPEN;
    els.delayPage.value = config.DELAY_PAGE_LOAD;
    els.delaySend.value = config.DELAY_BEFORE_SEND;
}

// Localize
function localizeHtml() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const msg = chrome.i18n.getMessage(key);
        if (msg) el.textContent = msg;
    });
    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const msg = chrome.i18n.getMessage(key);
        if (msg) el.placeholder = msg;
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    localizeHtml();

    chrome.storage.sync.get(['config'], (result) => {
        if (result.config) config = result.config;
        updateUI();
    });
});

// Add Helpers
function addTarget() {
    const val = els.newTarget.value.trim();
    if (val && !config.TARGET_MODELS.includes(val)) {
        config.TARGET_MODELS.push(val);
        els.newTarget.value = '';
        updateUI();
        saveConfig();
    }
}

function addAvoid() {
    const val = els.newAvoid.value.trim();
    if (val && !config.MODELS_TO_AVOID.includes(val)) {
        config.MODELS_TO_AVOID.push(val);
        els.newAvoid.value = '';
        updateUI();
        saveConfig();
    }
}

// Click Listeners
els.addTargetBtn.addEventListener('click', addTarget);
els.addAvoidBtn.addEventListener('click', addAvoid);

// Enter Key Listeners
els.newTarget.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTarget();
});
els.newAvoid.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addAvoid();
});

// Auto-save on delay input changes
els.delayMenu.addEventListener('input', saveConfig);
els.delayPage.addEventListener('input', saveConfig);
els.delaySend.addEventListener('input', saveConfig);

// Reset
document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm(chrome.i18n.getMessage('confirmReset'))) {
        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        updateUI();

        chrome.storage.sync.set({ config }, () => {
            showSaveIndicator();
        });
    }
});
