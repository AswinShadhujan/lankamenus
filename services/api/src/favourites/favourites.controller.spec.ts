import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { FavouritesController } from './favourites.controller';
import { FavouritesService } from './favourites.service';

describe('FavouritesController', () => {
  let controller: FavouritesController;
  let service: FavouritesService;

  const mockRestaurant = {
    id: 1,
    name_default: 'Test',
    city: 'Colombo',
    district: 'Colombo',
    address_line1: null,
    cuisine_tags: [],
    price_level: 1,
    veg_friendly: false,
    halal_certified: false,
    geom: null,
    created_at: new Date(),
  };

  beforeEach(async () => {
    const mockFavouritesService = {
      findAllByUserId: jest.fn().mockResolvedValue([]),
      add: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavouritesController],
      providers: [{ provide: FavouritesService, useValue: mockFavouritesService }],
    }).compile();

    controller = module.get<FavouritesController>(FavouritesController);
    service = module.get<FavouritesService>(FavouritesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /users/me/favourites', () => {
    it('should return { data: restaurants } when user authenticated', async () => {
      jest.spyOn(service, 'findAllByUserId').mockResolvedValue([mockRestaurant] as never);
      const req = { user: { userId: 1 } };
      const result = await controller.list(req);
      expect(service.findAllByUserId).toHaveBeenCalledWith(1);
      expect(result).toEqual({ data: [mockRestaurant] });
    });

    it('should throw UnauthorizedException when userId is null', async () => {
      const req = { user: { userId: null } };
      await expect(controller.list(req)).rejects.toThrow(UnauthorizedException);
      expect(service.findAllByUserId).not.toHaveBeenCalled();
    });
  });

  describe('POST /users/me/favourites', () => {
    it('should call add with userId and restaurantId', async () => {
      const req = { user: { userId: 1 } };
      await controller.add(req, { restaurantId: 2 });
      expect(service.add).toHaveBeenCalledWith(1, 2);
    });

    it('should throw UnauthorizedException when userId is null', async () => {
      const req = { user: {} };
      await expect(controller.add(req, { restaurantId: 1 })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(service.add).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundException when restaurant does not exist', async () => {
      jest.spyOn(service, 'add').mockRejectedValue(new NotFoundException('Restaurant not found'));
      const req = { user: { userId: 1 } };
      await expect(controller.add(req, { restaurantId: 999 })).rejects.toThrow(NotFoundException);
      await expect(controller.add(req, { restaurantId: 999 })).rejects.toThrow('Restaurant not found');
    });
  });

  describe('DELETE /users/me/favourites/:restaurantId', () => {
    it('should call remove with userId and restaurantId', async () => {
      const req = { user: { userId: 1 } };
      await controller.remove(req, 3);
      expect(service.remove).toHaveBeenCalledWith(1, 3);
    });

    it('should throw UnauthorizedException when userId is null', async () => {
      const req = { user: undefined };
      await expect(controller.remove(req, 1)).rejects.toThrow(UnauthorizedException);
      expect(service.remove).not.toHaveBeenCalled();
    });
  });
});
