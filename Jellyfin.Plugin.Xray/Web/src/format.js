const CAST_TYPES_WITH_GUESTS = ['Actor', 'GuestStar'];
const CAST_TYPES_ACTORS = ['Actor'];

export function selectCast(people, options = {}) {
  if (!Array.isArray(people)) {
    return [];
  }
  const { includeGuestStars = true, max = 50 } = options;
  const types = includeGuestStars ? CAST_TYPES_WITH_GUESTS : CAST_TYPES_ACTORS;
  return people.filter((person) => types.includes(person.Type)).slice(0, max);
}

export function contextHeader(item) {
  if (!item) {
    return '';
  }
  if (item.Type === 'Episode') {
    const season = item.ParentIndexNumber != null ? `S${item.ParentIndexNumber}` : '';
    const episode = item.IndexNumber != null ? `E${item.IndexNumber}` : '';
    const seasonEpisode = [season, episode].filter(Boolean).join(' ');
    const title = item.Name ? `'${item.Name}'` : '';
    return [item.SeriesName, seasonEpisode, title].filter(Boolean).join(' · ');
  }
  const year = item.ProductionYear ? `(${item.ProductionYear})` : '';
  return [item.Name, year].filter(Boolean).join(' ');
}
