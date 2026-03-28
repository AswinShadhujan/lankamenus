import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FavouritesService } from './favourites.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CacheService } from '../cache/cache.service';

describe('FavouritesService', () => {
  let service: FavouritesService;
  let prisma: PrismaService;

  const mockRestaurant = {
    id: 1,
    name_default: 'Test Restaurant',
    city: 'Colombo',
    district: 'Colombo',
    address_line1: null,
    cuisine_tags: ['Sri Lankan'],
    price_level: 2,
    veg_friendly: true,
    halal_certified: false,
    geom: null,
    created_at: new Date(),
  };

  let txFavouritesCreate: jest.Mock;
  let txRestaurantsUpdate: jest.Mock;

  beforeEach(async () => {
    txFavouritesCreate = jest.fn().mockResolvedValue({});
    txRestaurantsUpdate = jest.fn().mockResolvedValue({});

    const mockPrisma = {
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb({
          favourites: { create: txFavouritesCreate },
          restaurants: { update: txRestaurantsUpdate },
        });
      }),
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      favourites: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      restaurants: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const mockCache = {
      isConfigured: jest.fn().mockReturnValue(false),
      delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavouritesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<FavouritesService>(FavouritesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllByUserId', () => {
    it('should return restaurant list from favourites', async () => {
      jest.spyOn(prisma.favourites, 'findMany').mockResolvedValue([
        { restaurant: mockRestaurant, user_id: 1, restaurant_id: 1, id: 1, created_at: new Date() },
      ] as never);
      const result = await service.findAllByUserId(1);
      expect(prisma.favourites.findMany).toHaveBeenCalledWith({
        where: { user_id: 1 },
        orderBy: { created_at: 'desc' },
        include: { restaurant: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockRestaurant);
    });

    it('should return empty array when no favourites', async () => {
      jest.spyOn(prisma.favourites, 'findMany').mockResolvedValue([]);
      const result = await service.findAllByUserId(1);
      expect(result).toEqual([]);
    });
  });

  describe('add', () => {
    it('should throw NotFoundException when restaurant does not exist', async () => {
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(null);
      await expect(service.add(1, 999)).rejects.toThrow(NotFoundException);
      await expect(service.add(1, 999)).rejects.toThrow('Restaurant not found');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should create favourite and increment favorite_count when restaurant exists', async () => {
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(mockRestaurant as never);
      await service.add(1, 1);
      expect(txFavouritesCreate).toHaveBeenCalledWith({
        data: { user_id: 1, restaurant_id: 1 },
      });
      expect(txRestaurantsUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { favorite_count: { increment: 1 } },
      });
    });

    it('should not throw when duplicate (P2002) - idempotent', async () => {
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(mockRestaurant as never);
      const err = new PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '1',
      });
      txFavouritesCreate.mockRejectedValueOnce(err);
      await expect(service.add(1, 1)).resolves.not.toThrow();
    });
  });

  describe('remove', () => {
    it('should call deleteMany with user_id and restaurant_id', async () => {
      await service.remove(1, 2);
      expect(prisma.favourites.deleteMany).toHaveBeenCalledWith({
        where: { user_id: 1, restaurant_id: 2 },
      });
    });
  });
});
