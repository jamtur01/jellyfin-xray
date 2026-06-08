const BUTTON_CLASS = 'btnXray';

export function ensureButton(root, onClick, icon) {
  const buttons = root.querySelector('.videoOsdBottom .buttons.focuscontainer-x');
  if (!buttons || buttons.querySelector(`.${BUTTON_CLASS}`)) {
    return;
  }
  const settings = buttons.querySelector('.btnVideoOsdSettings');

  const button = root.createElement('button');
  button.setAttribute('is', 'paper-icon-button-light');
  button.className = `${BUTTON_CLASS} autoSize`;
  button.title = 'X-Ray';
  button.innerHTML = `<span class="xlargePaperIconButton material-icons ${icon}" aria-hidden="true"></span>`;
  button.addEventListener('click', onClick);

  if (settings) {
    settings.parentElement.insertBefore(button, settings);
  } else {
    buttons.appendChild(button);
  }
}

export function startObserver(onClick, icon) {
  const tryInject = () => ensureButton(document, onClick, icon);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length || mutation.removedNodes.length) {
        tryInject();
        return;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  tryInject();
  return observer;
}
