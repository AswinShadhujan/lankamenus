import { buildRestaurantsListCacheKey } from './cache-keys';

describe('buildRestaurantsListCacheKey', () => {
  it('should be deterministic for same logical query', () => {
    const a = buildRestaurantsListCacheKey(
      { page: '1', limit: '20', district: 'Colombo', q: 'rice' },
      1,
      20,
    );
    const b = buildRestaurantsListCacheKey(
      { limit: '20', page: '1', q: 'rice', district: 'Colombo' },
      1,
      20,
    );
    expect(a).toBe(b);
    expect(a.startsWith('restaurants:list:')).toBe(true);
  });

  it('should differ when resolved limit differs', () => {
    const a = buildRestaurantsListCacheKey({}, 1, 12);
    const b = buildRestaurantsListCacheKey({}, 1, 50);
    expect(a).not.toBe(b);
  });
});
