export function currentItemId(hash = window.location.hash) {
  const queryStart = (hash || '').indexOf('?');
  if (queryStart === -1) {
    return null;
  }
  return new URLSearchParams(hash.substring(queryStart + 1)).get('id');
}

// The experimental web client's playback route is just `#/video` (no id in the
// URL), so fall back to asking the server which item this device is playing.
export async function nowPlayingItemId(apiClient) {
  try {
    const sessions = await apiClient.getSessions({
      ControllableByUserId: apiClient.getCurrentUserId()
    });
    const deviceId = apiClient.deviceId();
    const session = (sessions || []).find(
      (entry) => entry.DeviceId === deviceId && entry.NowPlayingItem
    );
    return session ? session.NowPlayingItem.Id : null;
  } catch {
    return null;
  }
}

// Resolve the playing item id: the URL hash (older layouts) first, then the
// live session (experimental layout, where the hash carries no id).
export async function resolveItemId(apiClient, hash = window.location.hash) {
  return currentItemId(hash) || (await nowPlayingItemId(apiClient));
}

export function headshotUrl(apiClient, person, options = {}) {
  if (!person || !person.PrimaryImageTag) {
    return null;
  }
  // getImageUrl mutates its options object, so pass a fresh literal each call.
  return apiClient.getImageUrl(person.Id, {
    type: 'Primary',
    tag: person.PrimaryImageTag,
    maxHeight: options.maxHeight ?? 150
  });
}

export async function fetchItem(apiClient, itemId) {
  const userId = apiClient.getCurrentUserId();
  return apiClient.getItem(userId, itemId);
}
