import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DishFavouritesService } from './dish-favourites.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

describe('DishFavouritesService', () => {
  let service: DishFavouritesService;
  let prisma: PrismaService;

  const mockDish = {
    id: 10,
    name: 'Kottu',
    price: 12.5 as never,
    currency: 'LKR',
    image_url: 'https://example.com/d.jpg',
    menu_section: {
      menu: {
        id: 5,
        restaurant: { id: 3, name_default: 'Cafe' },
      },
    },
  };

  beforeEach(async () => {
    const mockPrisma = {
      user_dish_favourites: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      menu_items: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DishFavouritesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DishFavouritesService>(DishFavouritesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllByUserId', () => {
    it('maps rows to list items', async () => {
      jest.spyOn(prisma.user_dish_favourites, 'findMany').mockResolvedValue([
        {
          id: 1,
          user_id: 1,
          dish_id: 10,
          created_at: new Date(),
          menu_items: mockDish,
        },
      ] as never);
      const result = await service.findAllByUserId(1);
      expect(result).toEqual([
        {
          id: 10,
          menu_id: 5,
          name: 'Kottu',
          price: 12.5,
          currency: 'LKR',
          image_url: 'https://example.com/d.jpg',
          restaurant_id: 3,
          restaurant_name: 'Cafe',
        },
      ]);
    });
  });

  describe('add', () => {
    it('throws NotFoundException when dish missing', async () => {
      jest.spyOn(prisma.menu_items, 'findUnique').mockResolvedValue(null);
      await expect(service.add(1, 999)).rejects.toThrow(NotFoundException);
      expect(prisma.user_dish_favourites.create).not.toHaveBeenCalled();
    });

    it('creates row when dish exists', async () => {
      jest.spyOn(prisma.menu_items, 'findUnique').mockResolvedValue({ id: 10 } as never);
      await service.add(1, 10);
      expect(prisma.user_dish_favourites.create).toHaveBeenCalledWith({
        data: { user_id: 1, dish_id: 10 },
      });
    });

    it('is idempotent on P2002', async () => {
      jest.spyOn(prisma.menu_items, 'findUnique').mockResolvedValue({ id: 10 } as never);
      const err = new PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: '1',
      });
      jest.spyOn(prisma.user_dish_favourites, 'create').mockRejectedValueOnce(err);
      await expect(service.add(1, 10)).resolves.not.toThrow();
    });
  });

  describe('remove', () => {
    it('calls deleteMany', async () => {
      await service.remove(1, 10);
      expect(prisma.user_dish_favourites.deleteMany).toHaveBeenCalledWith({
        where: { user_id: 1, dish_id: 10 },
      });
    });
  });
});
