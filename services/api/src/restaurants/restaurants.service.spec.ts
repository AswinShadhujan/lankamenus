import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RestaurantsService } from './restaurants.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { CacheService } from '../cache/cache.service';
import { buildRestaurantsListCacheKey } from '../cache/cache-keys';
import { RankingService } from '../ranking/ranking.service';
import { SearchRestaurantsDto } from './dto/search-restaurants.dto';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

describe('RestaurantsService', () => {
  let service: RestaurantsService;
  let prisma: PrismaService;

  const mockRestaurant = {
    id: 1,
    name_default: 'Test Restaurant',
    city: 'Colombo',
    district: 'Colombo',
    address_line1: '123 Main St',
    cuisine_tags: ['Sri Lankan'],
    price_level: 2,
    veg_friendly: true,
    halal_certified: false,
    created_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      restaurants: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      $transaction: jest.fn((promises: Promise<unknown>[]) =>
        Promise.all(promises),
      ),
    };

    const mockSearchService = {
      isConfigured: jest.fn().mockReturnValue(false),
      indexRestaurant: jest.fn().mockResolvedValue(undefined),
      deleteRestaurantFromIndex: jest.fn().mockResolvedValue(undefined),
    };
    const mockCacheService = {
      isConfigured: jest.fn().mockReturnValue(false),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestaurantsService,
        RankingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SearchService, useValue: mockSearchService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RestaurantsService>(RestaurantsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('search', () => {
    it('should return page, pagesize, total, data when no location params', async () => {
      jest.spyOn(prisma, '$transaction').mockResolvedValue([2, [mockRestaurant, { ...mockRestaurant, id: 2 }]] as never);

      const dto: SearchRestaurantsDto = {};
      const result = await service.search(dto);

      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('pagesize', 20);
      expect(result).toHaveProperty('total', 2);
      expect(result).toHaveProperty('data');
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(2);
    });

    it('should prefer limit over pagesize when both provided', async () => {
      jest.spyOn(prisma, '$transaction').mockResolvedValue([5, [mockRestaurant]] as never);
      const result = await service.search({
        limit: '10',
        pagesize: '99',
      } as SearchRestaurantsDto);
      expect(result.pagesize).toBe(10);
      expect(result.meta.limit).toBe(10);
    });

    it('should throw BadRequestException when only lat provided', async () => {
      const dto: SearchRestaurantsDto = { lat: '6.9' };

      await expect(service.search(dto)).rejects.toThrow(BadRequestException);
      await expect(service.search(dto)).rejects.toThrow(
        'lat, lng, and radius_km must be provided together',
      );
    });

    it('should throw BadRequestException when only lng provided', async () => {
      const dto: SearchRestaurantsDto = { lng: '79.9' };

      await expect(service.search(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when lat and lng but no radius_km', async () => {
      const dto: SearchRestaurantsDto = { lat: '6.9', lng: '79.9' };

      await expect(service.search(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid lat', async () => {
      const dto: SearchRestaurantsDto = {
        lat: 'invalid',
        lng: '79.9',
        radius_km: '10',
      };

      await expect(service.search(dto)).rejects.toThrow(BadRequestException);
      await expect(service.search(dto)).rejects.toThrow('Invalid lat');
    });

    it('should throw BadRequestException for out-of-range lat', async () => {
      const dto: SearchRestaurantsDto = {
        lat: '95',
        lng: '79.9',
        radius_km: '10',
      };

      await expect(service.search(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid radius_km', async () => {
      const dto: SearchRestaurantsDto = {
        lat: '6.9',
        lng: '79.9',
        radius_km: '1000',
      };

      await expect(service.search(dto)).rejects.toThrow(BadRequestException);
      await expect(service.search(dto)).rejects.toThrow('radius_km');
    });

    it('should return empty data when location params valid but no restaurants in radius', async () => {
      jest.spyOn(prisma, '$queryRaw').mockResolvedValue([]);
      const dto: SearchRestaurantsDto = {
        lat: '6.9',
        lng: '79.9',
        radius_km: '10',
      };

      const result = await service.search(dto);

      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('data', []);
      expect(result.total).toBe(0);
    });

    it('should return data with distance_km when location params and query returns rows', async () => {
      jest.spyOn(prisma, '$queryRaw').mockResolvedValue([
        { id: 1, distance_m: 500 },
        { id: 2, distance_m: 2000 },
      ] as never);
      jest.spyOn(prisma, '$transaction').mockResolvedValue([
        2,
        [
          { ...mockRestaurant, id: 1 },
          { ...mockRestaurant, id: 2 },
        ],
      ] as never);

      const dto: SearchRestaurantsDto = {
        lat: '6.9',
        lng: '79.9',
        radius_km: '10',
      };

      const result = await service.search(dto);

      expect(result.data.length).toBe(2);
      expect(result.data[0]).toHaveProperty('distance_km', 0.5);
      expect(result.data[1]).toHaveProperty('distance_km', 2);
    });

    it('should build where.OR with menu item search when q is provided', async () => {
      jest.spyOn(prisma, '$transaction').mockResolvedValue([0, []] as never);

      const dto: SearchRestaurantsDto = { q: 'kottu' };
      await service.search(dto);

      expect(prisma.restaurants.findMany).toHaveBeenCalled();
      const findManyCall = (prisma.restaurants.findMany as jest.Mock).mock.calls[0][0];
      const where = findManyCall.where as { OR?: unknown[] };
      expect(where.OR).toBeDefined();
      expect(Array.isArray(where.OR)).toBe(true);
      expect(where.OR).toHaveLength(4);

      const menuClause = where.OR!.find(
        (clause: unknown) =>
          typeof clause === 'object' &&
          clause !== null &&
          'menus' in (clause as object),
      );
      expect(menuClause).toBeDefined();
      const menuClauseObj = menuClause as { menus: { some: unknown } };
      expect(menuClauseObj.menus.some).toMatchObject({
        is_active: true,
        menu_sections: {
          some: {
            menu_items: {
              some: {
                OR: [
                  { name: { contains: 'kottu', mode: 'insensitive' } },
                  { description: { contains: 'kottu', mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      });
    });

    it('should not add where.OR when q is empty or whitespace only', async () => {
      jest.spyOn(prisma, '$transaction').mockResolvedValue([0, []] as never);

      await service.search({ q: '   ' });

      const findManyCall = (prisma.restaurants.findMany as jest.Mock).mock.calls[0][0];
      const where = findManyCall.where as { OR?: unknown[] };
      expect(where.OR).toBeUndefined();
    });

    it('should combine q with district filter when both provided', async () => {
      jest.spyOn(prisma, '$transaction').mockResolvedValue([1, [mockRestaurant]] as never);

      const dto: SearchRestaurantsDto = { q: 'rice', district: 'Colombo' };
      const result = await service.search(dto);

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);

      const findManyCall = (prisma.restaurants.findMany as jest.Mock).mock.calls[0][0];
      const where = findManyCall.where as { OR?: unknown[]; district?: unknown };
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(4);
      expect(where.district).toEqual({ equals: 'Colombo', mode: 'insensitive' });
    });
  });

  describe('search with Redis cache', () => {
    let mockCacheService: {
      isConfigured: jest.Mock;
      get: jest.Mock;
      set: jest.Mock;
      del: jest.Mock;
      delByPattern: jest.Mock;
    };

    beforeEach(async () => {
      mockCacheService = {
        isConfigured: jest.fn().mockReturnValue(true),
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delByPattern: jest.fn().mockResolvedValue(undefined),
      };

      const mockPrisma = {
        restaurants: {
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(null),
          update: jest.fn().mockResolvedValue(null),
          delete: jest.fn().mockResolvedValue(undefined),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
        $executeRaw: jest.fn().mockResolvedValue(undefined),
        $transaction: jest.fn((promises: Promise<unknown>[]) =>
          Promise.all(promises),
        ),
      };

      const mockSearchService = {
        isConfigured: jest.fn().mockReturnValue(false),
        indexRestaurant: jest.fn().mockResolvedValue(undefined),
        deleteRestaurantFromIndex: jest.fn().mockResolvedValue(undefined),
      };

      const mockConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RestaurantsService,
          RankingService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: SearchService, useValue: mockSearchService },
          { provide: CacheService, useValue: mockCacheService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<RestaurantsService>(RestaurantsService);
      prisma = module.get<PrismaService>(PrismaService);
    });

    it('should return cached list without hitting DB when payload is valid', async () => {
      const cached = {
        data: [mockRestaurant],
        page: 1,
        pagesize: 20,
        total: 1,
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      mockCacheService.get.mockResolvedValue(JSON.stringify(cached));
      jest.spyOn(prisma, '$transaction');

      const result = await service.search({});

      expect(result).toEqual(cached);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(mockCacheService.get).toHaveBeenCalledWith(
        buildRestaurantsListCacheKey({}, 1, 20),
      );
    });

    it('should fall through to DB when cached JSON is invalid', async () => {
      mockCacheService.get.mockResolvedValue('not-json{');
      jest.spyOn(prisma, '$transaction').mockResolvedValue([0, []] as never);

      await service.search({});

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should fall through to DB when cached payload shape is invalid', async () => {
      mockCacheService.get.mockResolvedValue(JSON.stringify({ foo: 1 }));
      jest.spyOn(prisma, '$transaction').mockResolvedValue([0, []] as never);

      await service.search({});

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return restaurant when found', async () => {
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(mockRestaurant as never);
      const result = await service.findOne(1);
      expect(result).toEqual(mockRestaurant);
    });

    it('should throw NotFoundException when not found', async () => {
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow('Restaurant not found');
    });
  });

  describe('create', () => {
    const createDto: CreateRestaurantDto = {
      name_default: 'New Place',
      cuisine_tags: ['Sri Lankan', 'Indian'],
      city: 'Kandy',
      district: 'Kandy',
    };

    it('should create restaurant and return it via findOne', async () => {
      const created = { ...mockRestaurant, id: 5, name_default: createDto.name_default };
      jest.spyOn(prisma.restaurants, 'create').mockResolvedValue(created as never);
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(created as never);
      const result = await service.create(createDto);
      expect(prisma.restaurants.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name_default: createDto.name_default,
          city: createDto.city,
          district: createDto.district,
          cuisine_tags: createDto.cuisine_tags,
        }),
      });
      expect(result).toEqual(created);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('should call setGeomFromLatLng when lat and lng provided', async () => {
      const created = { ...mockRestaurant, id: 6 };
      jest.spyOn(prisma.restaurants, 'create').mockResolvedValue(created as never);
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(created as never);
      await service.create({ ...createDto, lat: 6.9, lng: 79.9 });
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const updateDto: UpdateRestaurantDto = {
      name_default: 'Updated Name',
      city: 'Colombo',
    };

    it('should update restaurant and return it via findOne', async () => {
      const updated = { ...mockRestaurant, id: 1, name_default: updateDto.name_default };
      jest.spyOn(prisma.restaurants, 'update').mockResolvedValue(updated as never);
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(updated as never);
      const result = await service.update(1, updateDto);
      expect(prisma.restaurants.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          name_default: updateDto.name_default,
          city: updateDto.city,
        }),
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when restaurant does not exist', async () => {
      const err = new PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '1',
      });
      jest.spyOn(prisma.restaurants, 'update').mockRejectedValue(err);
      await expect(service.update(999, updateDto)).rejects.toThrow(NotFoundException);
      await expect(service.update(999, updateDto)).rejects.toThrow('Restaurant not found');
    });

    it('should call $executeRaw when lat and lng provided', async () => {
      const updated = { ...mockRestaurant, id: 1 };
      jest.spyOn(prisma.restaurants, 'update').mockResolvedValue(updated as never);
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(updated as never);
      await service.update(1, { ...updateDto, lat: 7.0, lng: 80.0 });
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete restaurant', async () => {
      jest.spyOn(prisma.restaurants, 'delete').mockResolvedValue(mockRestaurant as never);
      await service.delete(1);
      expect(prisma.restaurants.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException when restaurant does not exist', async () => {
      const err = new PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '1',
      });
      jest.spyOn(prisma.restaurants, 'delete').mockRejectedValue(err);
      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });
  });
});
