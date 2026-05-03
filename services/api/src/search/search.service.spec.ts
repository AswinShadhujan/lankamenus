import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SearchService } from './search.service';
import { PrismaService } from '../prisma/prisma.service';
import { MEILISEARCH_INDEX_RESTAURANTS } from './constants';

const mockIndex = {
  addDocuments: jest.fn().mockResolvedValue(undefined),
  updateSearchableAttributes: jest.fn().mockResolvedValue(undefined),
  updateRankingRules: jest.fn().mockResolvedValue(undefined),
  updateDistinctAttribute: jest.fn().mockResolvedValue(undefined),
  deleteDocument: jest.fn().mockResolvedValue(undefined),
  search: jest.fn().mockResolvedValue({ hits: [], estimatedTotalHits: 0 }),
};

jest.mock('meilisearch', () => ({
  Meilisearch: jest.fn().mockImplementation(() => ({
    index: jest.fn().mockReturnValue(mockIndex),
  })),
}));

describe('SearchService', () => {
  let service: SearchService;
  let prisma: PrismaService;
  let config: ConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockIndex.addDocuments.mockResolvedValue(undefined);
    mockIndex.updateSearchableAttributes.mockResolvedValue(undefined);
    mockIndex.updateRankingRules.mockResolvedValue(undefined);
    mockIndex.updateDistinctAttribute.mockResolvedValue(undefined);
    mockIndex.deleteDocument.mockResolvedValue(undefined);
    mockIndex.search.mockResolvedValue({ hits: [], estimatedTotalHits: 0 });

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'MEILISEARCH_HOST') return '';
        if (key === 'MEILISEARCH_API_KEY') return undefined;
        return undefined;
      }),
    };
    const mockPrisma = {
      restaurants: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    prisma = module.get<PrismaService>(PrismaService);
    config = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('when Meilisearch not configured', () => {
    it('isConfigured should return false', () => {
      expect(service.isConfigured()).toBe(false);
    });

    it('getClient should return null', () => {
      expect(service.getClient()).toBeNull();
    });

    it('getRestaurantsIndexName should return index name', () => {
      expect(service.getRestaurantsIndexName()).toBe(MEILISEARCH_INDEX_RESTAURANTS);
    });

    it('indexRestaurant should not call Prisma or Meilisearch', async () => {
      await service.indexRestaurant(1);
      expect(prisma.restaurants.findUnique).not.toHaveBeenCalled();
      expect(mockIndex.addDocuments).not.toHaveBeenCalled();
    });

    it('deleteRestaurantFromIndex should not call Meilisearch', async () => {
      await service.deleteRestaurantFromIndex(1);
      expect(mockIndex.deleteDocument).not.toHaveBeenCalled();
    });

    it('searchRestaurantIds should return empty ids and zero totalHits', async () => {
      const result = await service.searchRestaurantIds('kottu');
      expect(result).toEqual({ ids: [], totalHits: 0 });
      expect(mockIndex.search).not.toHaveBeenCalled();
    });
  });

  describe('buildRestaurantDocument', () => {
    it('should return null when restaurant not found', async () => {
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(null);
      const result = await service.buildRestaurantDocument(999);
      expect(result).toBeNull();
    });

    it('should return document with restaurant and flattened menu items', async () => {
      const restaurant = {
        id: 1,
        name_default: 'Test',
        city: 'Colombo',
        district: 'Colombo',
        cuisine_tags: ['Sri Lankan'],
        price_level: 2,
        veg_friendly: true,
        halal_certified: false,
        menus: [
          {
            menu_sections: [
              {
                menu_items: [
                  { name: 'Kottu', description: 'Spicy' },
                  { name: 'Rice', description: null },
                ],
              },
            ],
          },
        ],
      };
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(restaurant as never);
      const result = await service.buildRestaurantDocument(1);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.name_default).toBe('Test');
      expect(result!.menu_item_names).toEqual(['Kottu', 'Rice']);
      expect(result!.menu_item_descriptions).toEqual(['Spicy']);
    });
  });

  describe('when Meilisearch configured', () => {
    beforeEach(async () => {
      const mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'MEILISEARCH_HOST') return 'http://localhost:7700';
          if (key === 'MEILISEARCH_API_KEY') return 'key';
          return undefined;
        }),
      };
      const mockPrisma = {
        restaurants: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SearchService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: PrismaService, useValue: mockPrisma },
        ],
      }).compile();
      service = module.get<SearchService>(SearchService);
      prisma = module.get<PrismaService>(PrismaService);
    });

    it('isConfigured should return true', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('getClient should return client', () => {
      expect(service.getClient()).not.toBeNull();
    });

    it('indexRestaurant should call buildRestaurantDocument and addDocuments when doc exists', async () => {
      const doc = {
        id: 1,
        name_default: 'R',
        city: null,
        district: null,
        cuisine_tags: [],
        price_level: null,
        veg_friendly: null,
        halal_certified: null,
        menu_item_names: ['Kottu'],
        menu_item_descriptions: [],
      };
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue({
        id: 1,
        name_default: 'R',
        city: null,
        district: null,
        cuisine_tags: [],
        price_level: null,
        veg_friendly: null,
        halal_certified: null,
        menus: [{ menu_sections: [{ menu_items: [{ name: 'Kottu', description: null }] }] }],
      } as never);
      await service.indexRestaurant(1);
      expect(mockIndex.addDocuments).toHaveBeenCalledWith(
        [expect.objectContaining({ id: 1, name_default: 'R', menu_item_names: ['Kottu'] })],
        { primaryKey: 'id' },
      );
      expect(mockIndex.updateSearchableAttributes).toHaveBeenCalled();
      expect(mockIndex.updateRankingRules).toHaveBeenCalled();
      expect(mockIndex.updateDistinctAttribute).toHaveBeenCalledWith('name_default');
    });

    it('indexRestaurant should not call addDocuments when buildRestaurantDocument returns null', async () => {
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(null);
      await service.indexRestaurant(999);
      expect(mockIndex.addDocuments).not.toHaveBeenCalled();
    });

    it('deleteRestaurantFromIndex should call deleteDocument', async () => {
      await service.deleteRestaurantFromIndex(5);
      expect(mockIndex.deleteDocument).toHaveBeenCalledWith(5);
    });

    it('searchRestaurantIds should return ids and totalHits and re-rank by name prefix tier', async () => {
      mockIndex.search.mockResolvedValue({
        hits: [
          { id: 2, name_default: 'Tamil Pasanga Mutton Shop' },
          { id: 1, name_default: 'Pasan Cafe' },
        ],
        estimatedTotalHits: 10,
      });
      const result = await service.searchRestaurantIds('pasan', { limit: 100 });
      expect(result.totalHits).toBe(10);
      expect(result.ids).toEqual([1, 2]);
      expect(mockIndex.search).toHaveBeenCalledWith('pasan', {
        limit: 100,
        attributesToRetrieve: ['id', 'name_default'],
      });
    });

    it('searchRestaurantIds should cap limit at 2000', async () => {
      await service.searchRestaurantIds('x', { limit: 5000 });
      expect(mockIndex.search).toHaveBeenCalledWith(
        'x',
        expect.objectContaining({ limit: 2000 }),
      );
    });
  });
});
