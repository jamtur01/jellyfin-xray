export function currentItemId(hash = window.location.hash) {
  const queryStart = (hash || '').indexOf('?');
  if (queryStart === -1) {
    return null;
  }
  return new URLSearchParams(hash.substring(queryStart + 1)).get('id');
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
