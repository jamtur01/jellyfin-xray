import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureButton, startObserver } from './observer.js';

beforeEach(() => {
  document.body.innerHTML = `
    <div class="videoOsdBottom">
      <div class="buttons focuscontainer-x">
        <button class="btnVideoOsdSettings"></button>
      </div>
    </div>`;
});

describe('ensureButton', () => {
  it('inserts the X-Ray button before the settings button', () => {
    ensureButton(document, vi.fn(), 'people');

    const buttons = document.querySelector('.videoOsdBottom .buttons');
    const xray = buttons.querySelector('.btnXray');
    expect(xray).not.toBeNull();
    expect(xray.nextElementSibling.classList.contains('btnVideoOsdSettings')).toBe(true);
  });

  it('does not insert a second button', () => {
    ensureButton(document, vi.fn(), 'people');
    ensureButton(document, vi.fn(), 'people');

    expect(document.querySelectorAll('.btnXray')).toHaveLength(1);
  });

  it('invokes the click handler', () => {
    const onClick = vi.fn();
    ensureButton(document, onClick, 'people');

    document.querySelector('.btnXray').click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does nothing when the OSD is absent', () => {
    document.body.innerHTML = '<div></div>';
    ensureButton(document, vi.fn(), 'people');
    expect(document.querySelector('.btnXray')).toBeNull();
  });

  it('appends the button when the settings button is absent', () => {
    document.querySelector('.btnVideoOsdSettings').remove();
    ensureButton(document, vi.fn(), 'people');
    const xray = document.querySelector('.btnXray');
    expect(xray).not.toBeNull();
    expect(xray.parentElement.classList.contains('focuscontainer-x')).toBe(true);
  });
});

describe('startObserver', () => {
  it('observes body and injects the button immediately', () => {
    const observeSpy = vi.fn();
    const OriginalMO = global.MutationObserver;
    global.MutationObserver = class {
      constructor(cb) { this.cb = cb; }
      observe(...a) { observeSpy(...a); }
      disconnect() {}
    };
    try {
      const onClick = vi.fn();
      startObserver(onClick, 'people');
      expect(observeSpy).toHaveBeenCalledWith(document.body, { childList: true, subtree: true });
      expect(document.querySelector('.btnXray')).not.toBeNull();
    } finally {
      global.MutationObserver = OriginalMO;
    }
  });
});
