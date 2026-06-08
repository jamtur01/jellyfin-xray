import { describe, it, expect, vi } from 'vitest';
import { currentItemId, headshotUrl, fetchItem } from './data.js';

describe('currentItemId', () => {
  it('reads the id from a video hash', () => {
    expect(currentItemId('#/video?id=abc123&foo=1')).toBe('abc123');
  });

  it('returns null without a query', () => {
    expect(currentItemId('#/home')).toBeNull();
  });

  it('returns null when the query has no id', () => {
    expect(currentItemId('#/video?foo=bar')).toBeNull();
  });
});

describe('headshotUrl', () => {
  it('builds a primary image url with a fresh options object', () => {
    const apiClient = { getImageUrl: vi.fn(() => 'http://x/img') };
    const person = { Id: 'p1', PrimaryImageTag: 'tag1' };

    const url = headshotUrl(apiClient, person);

    expect(url).toBe('http://x/img');
    expect(apiClient.getImageUrl).toHaveBeenCalledWith('p1', {
      type: 'Primary',
      tag: 'tag1',
      maxHeight: 150
    });
  });

  it('uses a caller-supplied maxHeight', () => {
    const apiClient = { getImageUrl: vi.fn(() => 'http://x/img') };
    const person = { Id: 'p1', PrimaryImageTag: 'tag1' };

    headshotUrl(apiClient, person, { maxHeight: 300 });

    expect(apiClient.getImageUrl).toHaveBeenCalledWith('p1', {
      type: 'Primary',
      tag: 'tag1',
      maxHeight: 300
    });
  });

  it('returns null when there is no headshot', () => {
    const apiClient = { getImageUrl: vi.fn() };
    expect(headshotUrl(apiClient, { Id: 'p1', PrimaryImageTag: null })).toBeNull();
    expect(apiClient.getImageUrl).not.toHaveBeenCalled();
  });
});

describe('fetchItem', () => {
  it('fetches with the current user id', async () => {
    const apiClient = {
      getCurrentUserId: vi.fn(() => 'user1'),
      getItem: vi.fn(async () => ({ Id: 'i1' }))
    };

    const item = await fetchItem(apiClient, 'i1');

    expect(item.Id).toBe('i1');
    expect(apiClient.getItem).toHaveBeenCalledWith('user1', 'i1');
  });
});
