import { contextHeader } from './format.js';
import { headshotUrl } from './data.js';

function firstInitial(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

function buildCard(person, apiClient, index) {
  const card = document.createElement('button');
  card.className = 'xray-card';
  card.type = 'button';
  card.style.setProperty('--i', index);

  const url = headshotUrl(apiClient, person);
  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = person.Name || '';
    img.loading = 'lazy';
    card.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'xray-initials';
    placeholder.textContent = firstInitial(person.Name);
    card.appendChild(placeholder);
  }

  const name = document.createElement('div');
  name.className = 'xray-name';
  name.textContent = person.Name || '';
  card.appendChild(name);

  const role = document.createElement('div');
  role.className = 'xray-role';
  role.textContent = person.Role || '';
  card.appendChild(role);

  card.addEventListener('click', () => {
    window.location.hash = `#/details?id=${encodeURIComponent(person.Id)}`;
  });

  return card;
}

export function buildPanel({ item, cast, apiClient, onClose }) {
  const panel = document.createElement('div');
  panel.className = 'xray-panel';

  const close = document.createElement('button');
  close.className = 'xray-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Close X-Ray');
  close.textContent = '✕';
  close.addEventListener('click', () => onClose && onClose());
  panel.appendChild(close);

  const header = document.createElement('div');
  header.className = 'xray-header';
  const eyebrow = document.createElement('span');
  eyebrow.className = 'xray-eyebrow';
  eyebrow.textContent = 'X-Ray';
  const title = document.createElement('span');
  title.className = 'xray-title';
  title.textContent = contextHeader(item);
  header.appendChild(eyebrow);
  header.appendChild(title);
  panel.appendChild(header);

  if (!cast || cast.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'xray-empty';
    empty.textContent = 'No cast information available for this title.';
    panel.appendChild(empty);
    return panel;
  }

  const count = document.createElement('div');
  count.className = 'xray-count';
  count.textContent = `${cast.length} cast ${cast.length === 1 ? 'member' : 'members'}`;
  panel.appendChild(count);

  const list = document.createElement('div');
  list.className = 'xray-list';
  cast.forEach((person, index) => {
    list.appendChild(buildCard(person, apiClient, index));
  });
  panel.appendChild(list);

  return panel;
}
