import { RankingService } from './ranking.service';

describe('RankingService', () => {
  let service: RankingService;
  const mockPrisma = {
    restaurants: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RankingService(mockPrisma as never);
  });

  describe('resolveSortMode', () => {
    it('maps top_rated and rating alias', () => {
      expect(
        service.resolveSortMode({ sort: 'top_rated' } as never, false, false),
      ).toBe('top_rated');
      expect(
        service.resolveSortMode({ sort: 'rating' } as never, false, false),
      ).toBe('top_rated');
    });

    it('defaults to created_at when no location and no query', () => {
      expect(service.resolveSortMode({} as never, false, false)).toBe(
        'default_created',
      );
    });

    it('defaults to distance when location and no sort', () => {
      expect(service.resolveSortMode({} as never, true, false)).toBe('distance');
    });

    it('uses relevance when text query and no sort (no location)', () => {
      expect(service.resolveSortMode({} as never, false, true)).toBe(
        'default_relevance',
      );
    });
  });

  describe('usesDbRankingSort', () => {
    it('is true for popular, trending, top_rated', () => {
      expect(service.usesDbRankingSort('popular')).toBe(true);
      expect(service.usesDbRankingSort('trending')).toBe(true);
      expect(service.usesDbRankingSort('top_rated')).toBe(true);
      expect(service.usesDbRankingSort('default_created')).toBe(false);
    });
  });

  describe('getTopRated / getPopular / getTrending', () => {
    it('getTopRated queries with rating order', async () => {
      await service.getTopRated({}, { take: 5, skip: 0 });
      expect(mockPrisma.restaurants.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 0,
          orderBy: expect.any(Array),
        }),
      );
    });

    it('getPopular queries with popular_score order', async () => {
      await service.getPopular();
      expect(mockPrisma.restaurants.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { popular_score: { sort: 'desc', nulls: 'last' } },
            { id: 'asc' },
          ],
        }),
      );
    });

    it('getTrending queries with trending_score order', async () => {
      await service.getTrending();
      expect(mockPrisma.restaurants.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ trending_score: 'desc' }, { id: 'asc' }],
        }),
      );
    });
  });
});
