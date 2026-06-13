import { describe, it, expect, vi } from 'vitest';
import { currentItemId, headshotUrl, fetchItem, nowPlayingItemId, resolveItemId } from './data.js';

function apiWithSessions(sessions, deviceId = 'dev-1', userId = 'user-1') {
  return {
    getCurrentUserId: () => userId,
    deviceId: () => deviceId,
    getSessions: vi.fn(async () => sessions)
  };
}

describe('nowPlayingItemId', () => {
  it("returns this device's now-playing item id", async () => {
    const api = apiWithSessions([
      { DeviceId: 'other', NowPlayingItem: { Id: 'x' } },
      { DeviceId: 'dev-1', NowPlayingItem: { Id: 'heat-1' } }
    ]);
    expect(await nowPlayingItemId(api)).toBe('heat-1');
    expect(api.getSessions).toHaveBeenCalledWith({ ControllableByUserId: 'user-1' });
  });

  it('returns null when this device is not playing anything', async () => {
    const api = apiWithSessions([{ DeviceId: 'dev-1' }, { DeviceId: 'other', NowPlayingItem: { Id: 'x' } }]);
    expect(await nowPlayingItemId(api)).toBeNull();
  });

  it('returns null and does not throw when getSessions fails', async () => {
    const api = { getCurrentUserId: () => 'u', deviceId: () => 'd', getSessions: vi.fn(async () => { throw new Error('boom'); }) };
    expect(await nowPlayingItemId(api)).toBeNull();
  });
});

describe('resolveItemId', () => {
  it('prefers the id from the hash when present', async () => {
    const api = apiWithSessions([{ DeviceId: 'dev-1', NowPlayingItem: { Id: 'session-id' } }]);
    expect(await resolveItemId(api, '#/video?id=hash-id')).toBe('hash-id');
    expect(api.getSessions).not.toHaveBeenCalled();
  });

  it('falls back to the session when the hash has no id', async () => {
    const api = apiWithSessions([{ DeviceId: 'dev-1', NowPlayingItem: { Id: 'session-id' } }]);
    expect(await resolveItemId(api, '#/video')).toBe('session-id');
  });
});

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
