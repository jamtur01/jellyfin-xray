import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPanel } from './panel.js';

const apiClient = { getImageUrl: () => 'http://x/img' };
const item = { Type: 'Movie', Name: 'Heat', ProductionYear: 1995 };
const cast = [
  { Id: 'p1', Name: 'Al Pacino', Role: 'Hanna', Type: 'Actor', PrimaryImageTag: 't1' },
  { Id: 'p2', Name: 'Extra', Role: '', Type: 'Actor', PrimaryImageTag: null }
];

beforeEach(() => {
  window.location.hash = '';
});

describe('buildPanel', () => {
  it('renders the header and one card per cast member', () => {
    const panel = buildPanel({ item, cast, apiClient });

    expect(panel.querySelector('.xray-header').textContent).toContain('Heat (1995)');
    expect(panel.querySelectorAll('.xray-card')).toHaveLength(2);
    expect(panel.querySelector('.xray-card .xray-name').textContent).toBe('Al Pacino');
    expect(panel.querySelector('.xray-card .xray-role').textContent).toBe('Hanna');
  });

  it('shows an initials placeholder when there is no headshot', () => {
    const panel = buildPanel({ item, cast, apiClient });
    const second = panel.querySelectorAll('.xray-card')[1];
    expect(second.querySelector('img')).toBeNull();
    expect(second.querySelector('.xray-initials').textContent).toBe('E');
  });

  it('navigates to the person page on card click', () => {
    const panel = buildPanel({ item, cast, apiClient });
    panel.querySelector('.xray-card').click();
    expect(window.location.hash).toBe('#/details?id=p1');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    const panel = buildPanel({ item, cast, apiClient, onClose });
    panel.querySelector('.xray-close').click();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows an empty message when there is no cast', () => {
    const panel = buildPanel({ item, cast: [], apiClient });
    expect(panel.querySelector('.xray-empty').textContent).toContain('No cast information');
  });

  it('shows an empty message when cast is null', () => {
    const panel = buildPanel({ item, cast: null, apiClient });
    expect(panel.querySelector('.xray-empty').textContent).toContain('No cast information');
  });

  it('does not throw when close button is clicked with no onClose', () => {
    const panel = buildPanel({ item, cast, apiClient });
    expect(() => panel.querySelector('.xray-close').click()).not.toThrow();
  });
});
