import css from './xray.css';
import { startObserver } from './observer.js';
import { currentItemId, fetchItem } from './data.js';
import { selectCast } from './format.js';
import { buildPanel } from './panel.js';

const DEFAULT_CONFIG = { includeGuestStars: true, maxCast: 50, buttonIcon: 'people' };
let config = DEFAULT_CONFIG;
let currentPanel = null;
let panelLoading = false;

function injectStyles() {
  if (document.getElementById('xray-styles')) {
    return;
  }
  const style = document.createElement('style');
  style.id = 'xray-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

function closePanel() {
  if (currentPanel) {
    currentPanel.remove();
    currentPanel = null;
    document.removeEventListener('keydown', onKeydown);
    document.removeEventListener('pointerdown', onOutsideClick);
  }
}

function onOutsideClick(event) {
  if (currentPanel && !currentPanel.contains(event.target)) {
    closePanel();
  }
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    closePanel();
  }
}

async function openPanel() {
  if (currentPanel) {
    closePanel();
    return;
  }
  if (!window.ApiClient) {
    return;
  }
  if (panelLoading) {
    return;
  }
  panelLoading = true;
  try {
    const itemId = currentItemId();
    if (!itemId) {
      return;
    }
    let item;
    try {
      item = await fetchItem(window.ApiClient, itemId);
    } catch (error) {
      console.warn('[XRay] Failed to load item metadata:', error);
      item = null;
    }
    const cast = selectCast(item && item.People, {
      includeGuestStars: config.includeGuestStars,
      max: config.maxCast
    });
    const host = document.querySelector('.videoOsdBottom')?.parentElement || document.body;
    currentPanel = buildPanel({ item, cast, apiClient: window.ApiClient, onClose: closePanel });
    host.appendChild(currentPanel);
    document.addEventListener('keydown', onKeydown);
    setTimeout(function () { document.addEventListener('pointerdown', onOutsideClick); }, 0);
  } finally {
    panelLoading = false;
  }
}

async function loadConfig() {
  try {
    const response = await fetch(window.ApiClient.getUrl('XRay/config'));
    if (response.ok) {
      const dto = await response.json();
      config = {
        includeGuestStars: dto.IncludeGuestStars,
        maxCast: dto.MaxCast,
        buttonIcon: dto.ButtonIcon
      };
    }
  } catch {
    config = DEFAULT_CONFIG;
  }
}

(async function init() {
  injectStyles();
  await loadConfig();
  startObserver(openPanel, config.buttonIcon);

  const teardownObserver = new MutationObserver(() => {
    if (currentPanel && !document.contains(currentPanel)) {
      closePanel();
    }
  });
  teardownObserver.observe(document.body, { childList: true, subtree: true });
})();
