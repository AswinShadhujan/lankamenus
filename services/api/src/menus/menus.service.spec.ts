import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { MenusService } from './menus.service';
import { MenuItemClickTrackerService } from './menu-item-click-tracker.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { CacheService } from '../cache/cache.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

describe('MenusService', () => {
  let service: MenusService;
  let prisma: PrismaService;
  let mockClickTracker: { shouldIncrementClick: jest.Mock };

  const mockReq = { headers: {}, ip: '127.0.0.1' } as Request;

  const mockRestaurant = { id: 1, name_default: 'Test Restaurant' };
  const mockMenu = {
    id: 1,
    restaurant_id: 1,
    name: 'Main Menu',
    is_active: true,
  };
  const mockSection = {
    id: 1,
    menu_id: 1,
    name: 'Starters',
    sort_order: 0,
    menu: { restaurant_id: 1 },
  };
  const mockItem = {
    id: 1,
    menu_section_id: 1,
    name: 'Soup',
    description: null,
    price: null,
    currency: 'LKR',
    veg: false,
    sort_order: 0,
    is_available: true,
    is_popular: false,
    is_recommended: false,
    menu_section: { id: 1, menu_id: 1, menu: { restaurant_id: 1 } },
  };

  beforeEach(async () => {
    const mockPrisma = {
      restaurants: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      menus: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      menu_sections: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      menu_items: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(null),
        delete: jest.fn().mockResolvedValue(undefined),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    const mockSearchService = {
      indexRestaurant: jest.fn().mockResolvedValue(undefined),
    };
    const mockCacheService = {
      isConfigured: jest.fn().mockReturnValue(false),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    mockClickTracker = {
      shouldIncrementClick: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenusService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SearchService, useValue: mockSearchService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: MenuItemClickTrackerService, useValue: mockClickTracker },
      ],
    }).compile();

    service = module.get<MenusService>(MenusService);
    prisma = module.get<PrismaService>(PrismaService);
    clickTracker = module.get<MenuItemClickTrackerService>(MenuItemClickTrackerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByRestaurant', () => {
    it('should throw NotFoundException when restaurant not found', async () => {
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(null);
      await expect(service.findByRestaurant(999)).rejects.toThrow(NotFoundException);
      await expect(service.findByRestaurant(999)).rejects.toThrow('Restaurant not found');
    });

    it('should return menus when restaurant exists', async () => {
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(mockRestaurant as never);
      jest.spyOn(prisma.menus, 'findMany').mockResolvedValue([mockMenu] as never);
      const result = await service.findByRestaurant(1);
      expect(result).toEqual([mockMenu]);
      expect(prisma.menus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { restaurant_id: 1, is_active: true },
        }),
      );
    });
  });

  describe('createMenu', () => {
    const dto: CreateMenuDto = { name: 'Lunch Menu' };

    it('should throw NotFoundException when restaurant not found', async () => {
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(null);
      await expect(service.createMenu(999, dto)).rejects.toThrow(NotFoundException);
    });

    it('should create menu when restaurant exists', async () => {
      jest.spyOn(prisma.restaurants, 'findUnique').mockResolvedValue(mockRestaurant as never);
      jest.spyOn(prisma.menus, 'create').mockResolvedValue({ ...mockMenu, name: dto.name } as never);
      const result = await service.createMenu(1, dto);
      expect(prisma.menus.create).toHaveBeenCalledWith({
        data: {
          restaurant_id: 1,
          name: dto.name,
          is_active: true,
        },
      });
      expect(result.name).toBe(dto.name);
    });
  });

  describe('updateMenu', () => {
    const dto: UpdateMenuDto = { name: 'Updated Menu' };

    it('should update menu and return it', async () => {
      const updated = { ...mockMenu, name: dto.name };
      jest.spyOn(prisma.menus, 'update').mockResolvedValue(updated as never);
      const result = await service.updateMenu(1, dto);
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when menu does not exist', async () => {
      const err = new PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '1',
      });
      jest.spyOn(prisma.menus, 'update').mockRejectedValue(err);
      await expect(service.updateMenu(999, dto)).rejects.toThrow(NotFoundException);
      await expect(service.updateMenu(999, dto)).rejects.toThrow('Menu not found');
    });
  });

  describe('deleteMenu', () => {
    it('should delete menu', async () => {
      jest.spyOn(prisma.menus, 'findUnique').mockResolvedValue(mockMenu as never);
      jest.spyOn(prisma.menus, 'delete').mockResolvedValue(mockMenu as never);
      await service.deleteMenu(1);
      expect(prisma.menus.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException when menu does not exist', async () => {
      const err = new PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '1',
      });
      jest.spyOn(prisma.menus, 'delete').mockRejectedValue(err);
      await expect(service.deleteMenu(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createSection', () => {
    const dto: CreateSectionDto = { name: 'Mains' };

    it('should throw NotFoundException when menu not found', async () => {
      jest.spyOn(prisma.menus, 'findUnique').mockResolvedValue(null);
      await expect(service.createSection(999, dto)).rejects.toThrow(NotFoundException);
      await expect(service.createSection(999, dto)).rejects.toThrow('Menu not found');
    });

    it('should create section when menu exists', async () => {
      jest.spyOn(prisma.menus, 'findUnique').mockResolvedValue(mockMenu as never);
      jest.spyOn(prisma.menu_sections, 'create').mockResolvedValue({ ...mockSection, name: dto.name } as never);
      const result = await service.createSection(1, dto);
      expect(prisma.menu_sections.create).toHaveBeenCalledWith({
        data: {
          menu_id: 1,
          name: dto.name,
          sort_order: 0,
        },
      });
      expect(result.name).toBe(dto.name);
    });
  });

  describe('updateSection', () => {
    const dto: UpdateSectionDto = { name: 'Updated Section' };

    it('should throw NotFoundException when section not in menu', async () => {
      jest.spyOn(prisma.menu_sections, 'findFirst').mockResolvedValue(null);
      await expect(service.updateSection(1, 999, dto)).rejects.toThrow(NotFoundException);
      await expect(service.updateSection(1, 999, dto)).rejects.toThrow('Section not found');
    });

    it('should update section when ownership valid', async () => {
      jest.spyOn(prisma.menu_sections, 'findFirst').mockResolvedValue(mockSection as never);
      const updated = { ...mockSection, name: dto.name };
      jest.spyOn(prisma.menu_sections, 'update').mockResolvedValue(updated as never);
      const result = await service.updateSection(1, 1, dto);
      expect(result.name).toBe(dto.name);
      expect(prisma.menu_sections.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: dto.name },
      });
    });
  });

  describe('deleteSection', () => {
    it('should throw NotFoundException when section not in menu', async () => {
      jest.spyOn(prisma.menu_sections, 'findFirst').mockResolvedValue(null);
      await expect(service.deleteSection(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('should delete section when ownership valid', async () => {
      jest.spyOn(prisma.menu_sections, 'findFirst').mockResolvedValue(mockSection as never);
      await service.deleteSection(1, 1);
      expect(prisma.menu_sections.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('createItem', () => {
    const dto: CreateMenuItemDto = {
      menu_section_id: 1,
      name: 'Rice',
    };

    it('should throw BadRequestException when section does not belong to menu', async () => {
      jest.spyOn(prisma.menu_sections, 'findFirst').mockResolvedValue(null);
      await expect(service.createItem(1, dto)).rejects.toThrow(BadRequestException);
      await expect(service.createItem(1, dto)).rejects.toThrow(
        'Section not found or does not belong to this menu',
      );
    });

    it('should create item when section belongs to menu', async () => {
      jest.spyOn(prisma.menu_sections, 'findFirst').mockResolvedValue(mockSection as never);
      jest.spyOn(prisma.menu_items, 'create').mockResolvedValue({ ...mockItem, name: dto.name } as never);
      const result = await service.createItem(1, dto);
      expect(prisma.menu_items.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: dto.name,
          menu_section: { connect: { id: 1 } },
        }),
      });
      expect(result.name).toBe(dto.name);
    });
  });

  describe('updateItem', () => {
    const dto: UpdateMenuItemDto = { name: 'Updated Item' };

    it('should throw NotFoundException when item not in menu', async () => {
      jest.spyOn(prisma.menu_items, 'findFirst').mockResolvedValue(null);
      await expect(service.updateItem(1, 999, dto)).rejects.toThrow(NotFoundException);
      await expect(service.updateItem(1, 999, dto)).rejects.toThrow('Menu item not found');
    });

    it('should throw NotFoundException when item belongs to different menu', async () => {
      jest.spyOn(prisma.menu_items, 'findFirst').mockResolvedValue({
        ...mockItem,
        menu_section: { id: 1, menu_id: 99 },
      } as never);
      await expect(service.updateItem(1, 1, dto)).rejects.toThrow(NotFoundException);
    });

    it('should update item when ownership valid', async () => {
      jest.spyOn(prisma.menu_items, 'findFirst').mockResolvedValue(mockItem as never);
      const updated = { ...mockItem, name: dto.name };
      jest.spyOn(prisma.menu_items, 'update').mockResolvedValue(updated as never);
      const result = await service.updateItem(1, 1, dto);
      expect(result.name).toBe(dto.name);
    });

    it('should throw BadRequestException when moving item to section not in menu', async () => {
      jest.spyOn(prisma.menu_items, 'findFirst').mockResolvedValue(mockItem as never);
      jest.spyOn(prisma.menu_sections, 'findFirst').mockResolvedValue(null);
      await expect(service.updateItem(1, 1, { menu_section_id: 999 })).rejects.toThrow(BadRequestException);
      await expect(service.updateItem(1, 1, { menu_section_id: 999 })).rejects.toThrow(
        'Section not found or does not belong to this menu',
      );
    });

    it('should clear image_url when set to null', async () => {
      jest.spyOn(prisma.menu_items, 'findFirst').mockResolvedValue({
        ...mockItem,
        image_url: 'https://example.com/old.jpg',
      } as never);
      jest.spyOn(prisma.menu_items, 'update').mockResolvedValue({
        ...mockItem,
        image_url: null,
      } as never);
      await service.updateItem(1, 1, { image_url: null });
      expect(prisma.menu_items.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { image_url: null },
      });
    });
  });

  describe('deleteItem', () => {
    it('should throw NotFoundException when item not in menu', async () => {
      jest.spyOn(prisma.menu_items, 'findFirst').mockResolvedValue(null);
      await expect(service.deleteItem(1, 999)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when item belongs to different menu', async () => {
      jest.spyOn(prisma.menu_items, 'findFirst').mockResolvedValue({
        ...mockItem,
        menu_section: { id: 1, menu_id: 99 },
      } as never);
      await expect(service.deleteItem(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('should delete item when ownership valid', async () => {
      jest.spyOn(prisma.menu_items, 'findFirst').mockResolvedValue(mockItem as never);
      await service.deleteItem(1, 1);
      expect(prisma.menu_items.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('findOneItem', () => {
    const itemWithContext = {
      ...mockItem,
      ingredients: ['chicken', 'bun'],
      rating: 4.4,
      rating_count: 28,
      image_url: 'https://example.com/burger.jpg',
      menu_section: {
        id: 1,
        name: 'Starters',
        menu_id: 1,
        menu: {
          id: 1,
          name: 'Main Menu',
          is_active: true,
          restaurant: { id: 1, name_default: 'Test Restaurant', slug: 'cafe-kumbuk' },
        },
      },
    };

    it('should throw NotFoundException when item not found', async () => {
      jest.spyOn(prisma.menu_items, 'findFirst').mockResolvedValue(null);
      await expect(service.findOneItem(1, 999, mockReq)).rejects.toThrow(NotFoundException);
      await expect(service.findOneItem(1, 999, mockReq)).rejects.toThrow('Menu item not found');
    });

    it('should throw NotFoundException when item belongs to different menu', async () => {
      jest.spyOn(prisma.menu_items, 'findFirst').mockResolvedValue({
        ...mockItem,
        menu_section: { ...itemWithContext.menu_section, menu_id: 99, menu: { ...itemWithContext.menu_section.menu, id: 99 } },
      } as never);
      await expect(service.findOneItem(1, 1, mockReq)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when menu is inactive', async () => {
      jest.spyOn(prisma.menu_items, 'findFirst').mockResolvedValue({
        ...itemWithContext,
        menu_section: {
          ...itemWithContext.menu_section,
          menu: { ...itemWithContext.menu_section.menu, is_active: false },
        },
      } as never);
      await expect(service.findOneItem(1, 1, mockReq)).rejects.toThrow(NotFoundException);
      await expect(service.findOneItem(1, 1, mockReq)).rejects.toThrow('Menu item not found');
    });

    it('should return dish detail with context when item exists and menu is active', async () => {
      jest.spyOn(prisma.menu_items, 'findFirst').mockResolvedValue(itemWithContext as never);
      const result = await service.findOneItem(1, 1);
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(result).toEqual({
        id: 1,
        name: 'Soup',
        description: null,
        price: null,
        currency: 'LKR',
        veg: false,
        sort_order: 0,
        ingredients: ['chicken', 'bun'],
        is_available: true,
        is_popular: false,
        is_recommended: false,
        rating: 4.4,
        rating_count: 28,
        image_url: 'https://example.com/burger.jpg',
        menu_section_id: 1,
        section_name: 'Starters',
        section: 'Starters',
        menu_id: 1,
        menu_name: 'Main Menu',
        restaurant_id: 1,
        restaurant_name: 'Test Restaurant',
        restaurant: { id: 1, name: 'Test Restaurant', slug: 'cafe-kumbuk' },
      });
    });

    it('should return empty/null for optional fields when not set', async () => {
      const minimalItem = {
        ...mockItem,
        ingredients: undefined,
        rating: null,
        rating_count: null,
        image_url: null,
        menu_section: {
          id: 1,
          name: 'Starters',
          menu_id: 1,
          menu: {
            id: 1,
            name: 'Main Menu',
            is_active: true,
            restaurant: { id: 1, name_default: 'Test Restaurant', slug: null },
          },
        },
      };
      jest.spyOn(prisma.menu_items, 'findFirst').mockResolvedValue(minimalItem as never);
      const result = await service.findOneItem(1, 1, mockReq);
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(result.ingredients).toEqual([]);
      expect(result.rating).toBeNull();
      expect(result.rating_count).toBe(0);
      expect(result.image_url).toBeNull();
      expect(result.restaurant.slug).toBeNull();
    });

    it('should not run click_count update when tracker is in cooldown', async () => {
      mockClickTracker.shouldIncrementClick.mockResolvedValue(false);
      jest.spyOn(prisma.menu_items, 'findFirst').mockResolvedValue(itemWithContext as never);
      jest.spyOn(prisma, '$executeRaw').mockClear();
      await service.findOneItem(1, 1, mockReq);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
  });
});
