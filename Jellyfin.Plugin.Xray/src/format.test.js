import { describe, it, expect } from 'vitest';
import { selectCast, contextHeader } from './format.js';

describe('selectCast', () => {
  const people = [
    { Name: 'A', Type: 'Actor' },
    { Name: 'D', Type: 'Director' },
    { Name: 'G', Type: 'GuestStar' }
  ];

  it('includes actors and guest stars by default', () => {
    expect(selectCast(people).map((p) => p.Name)).toEqual(['A', 'G']);
  });

  it('excludes guest stars when disabled', () => {
    expect(selectCast(people, { includeGuestStars: false }).map((p) => p.Name)).toEqual(['A']);
  });

  it('caps the list at max', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ Name: `A${i}`, Type: 'Actor' }));
    expect(selectCast(many, { max: 2 })).toHaveLength(2);
  });

  it('tolerates missing People', () => {
    expect(selectCast(undefined)).toEqual([]);
  });
});

describe('contextHeader', () => {
  it('formats an episode', () => {
    const item = { Type: 'Episode', SeriesName: 'The Bear', ParentIndexNumber: 2, IndexNumber: 4, Name: 'Honeydew' };
    expect(contextHeader(item)).toBe("The Bear · S2 E4 · 'Honeydew'");
  });

  it('formats a movie with year', () => {
    expect(contextHeader({ Type: 'Movie', Name: 'Heat', ProductionYear: 1995 })).toBe('Heat (1995)');
  });

  it('returns empty string for nullish item', () => {
    expect(contextHeader(null)).toBe('');
  });
});
