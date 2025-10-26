import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { SearchRestaurantsDto } from './dto/search-restaurants.dto';

@Injectable()
export class RestaurantsService {
  constructor(private prisma: PrismaService) {}

  async search(dto: SearchRestaurantsDto) {
    const page = Math.max(parseInt(dto.page ?? '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(dto.pagesize ?? '20', 10), 1), 100);
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: Prisma.restaurantsWhereInput = {};

    // Text search
    if (dto.q) {
      where.OR = [
        { name_default: { contains: dto.q, mode: 'insensitive' } },
        { city: { contains: dto.q, mode: 'insensitive' } },
        { district: { contains: dto.q, mode: 'insensitive' } },
      ];
    }

    // Filters
    if (dto.city) where.city = { equals: dto.city, mode: 'insensitive' };
    if (dto.district) where.district = { equals: dto.district, mode: 'insensitive' };

    // Cuisine filter
    const cuisines = Array.isArray(dto.cuisine)
      ? dto.cuisine
      : dto.cuisine
      ? String(dto.cuisine).split(',').map(s => s.trim())
      : undefined;
    if (cuisines?.length) where.cuisine_tags = { hasSome: cuisines };

    // Dietary flags
    if (dto.veg === 'true') where.veg_friendly = true;
    if (dto.halal === 'true') where.halal_certified = true;

    // Price levels
    const priceLevels: number[] | undefined = Array.isArray(dto.pricelevel)
      ? dto.pricelevel.map(p => Number(p)).filter(n => !isNaN(n))
      : dto.pricelevel
      ? String(dto.pricelevel)
          .split(',')
          .map(p => Number(p))
          .filter(n => !isNaN(n))
      : undefined;
    if (priceLevels && priceLevels.length > 0) {
      where.price_level = { in: priceLevels };
    }

    // Sorting (default by name)
    const orderBy: Prisma.restaurantsOrderByWithRelationInput[] = [{ name_default: 'asc' }];

    const [total, data] = await this.prisma.$transaction([
      this.prisma.restaurants.count({ where }),
      this.prisma.restaurants.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          name_default: true,
          city: true,
          district: true,
          address_line1: true,
          cuisine_tags: true,
          price_level: true,
          veg_friendly: true,
          halal_certified: true,
          created_at: true,
        },
      }),
    ]);

    return {
      page,
      pagesize: pageSize,
      total,
      data,
    };
  }

  async findOne(id: number) {
    return this.prisma.restaurants.findUnique({
      where: { id },
    });
  }
}
