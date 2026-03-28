import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { DishGeoQueryDto } from './dto/dish-geo.query.dto';

/** Default radius when `lat` + `lng` are sent without `radius_km`. */
const DEFAULT_DISH_GEO_RADIUS_KM = 12;

/** Unified discovery card JSON for featured + trending. */
export type DishDiscoveryRow = {
  id: number;
  name: string;
  price: number | null;
  currency: string;
  image_url: string | null;
  is_popular: boolean;
  is_recommended: boolean;
  click_count: number;
  menu_id: number;
  restaurant: {
    id: number;
    name: string;
    rating: number | null;
  };
};

type RawDishRow = {
  id: number;
  name: string;
  price: Prisma.Decimal | null;
  currency: string | null;
  image_url: string | null;
  is_popular: boolean;
  is_recommended: boolean;
  click_count: number;
  menu_id: number;
  restaurant_id: number;
  restaurant_name: string;
  restaurant_rating: number | null;
};

@Injectable()
export class DishesService {
  private readonly logger = new Logger(DishesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private isDevDebug(): boolean {
    return this.config.get<string>('NODE_ENV') !== 'production';
  }

  private parseGeo(
    query: DishGeoQueryDto,
  ): { lat: number; lng: number; radiusM: number } | null {
    const latRaw = query.lat?.trim();
    const lngRaw = query.lng?.trim();
    const radiusRaw = query.radius_km?.trim();

    if (!latRaw && !lngRaw && !radiusRaw) {
      return null;
    }

    if (!latRaw || !lngRaw) {
      throw new BadRequestException(
        'lat and lng must be provided together for location filtering (optional: radius_km)',
      );
    }

    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      throw new BadRequestException('Invalid lat');
    }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      throw new BadRequestException('Invalid lng');
    }

    const radiusKm = radiusRaw
      ? parseFloat(radiusRaw)
      : DEFAULT_DISH_GEO_RADIUS_KM;
    if (Number.isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
      throw new BadRequestException(
        'radius_km must be a number between 0 and 500',
      );
    }

    return { lat, lng, radiusM: radiusKm * 1000 };
  }

  private buildLocationFilter(
    geo: { lat: number; lng: number; radiusM: number },
  ): Prisma.Sql {
    return Prisma.sql`
      AND (
        (
          r.geom IS NOT NULL
          AND ST_DWithin(
            r.geom::geography,
            ST_SetSRID(ST_MakePoint(${geo.lng}, ${geo.lat}), 4326)::geography,
            ${geo.radiusM}
          )
        )
        OR (
          r.geom IS NULL
          AND r.latitude IS NOT NULL
          AND r.longitude IS NOT NULL
          AND (
            6371000.0
            * acos(
              LEAST(
                1.0::double precision,
                GREATEST(
                  -1.0::double precision,
                  cos(radians(${geo.lat}::double precision))
                    * cos(radians(r.latitude::double precision))
                    * cos(
                      radians(r.longitude::double precision)
                      - radians(${geo.lng}::double precision)
                    )
                  + sin(radians(${geo.lat}::double precision))
                    * sin(radians(r.latitude::double precision))
                )
              )
            )
          )
          <= ${geo.radiusM}::double precision
        )
      )
    `;
  }

  private mapRow(r: RawDishRow): DishDiscoveryRow {
    return {
      id: r.id,
      name: r.name,
      price: r.price != null ? Number(r.price) : null,
      currency: r.currency?.trim() || 'LKR',
      image_url: r.image_url,
      is_popular: r.is_popular,
      is_recommended: r.is_recommended,
      click_count: r.click_count ?? 0,
      menu_id: r.menu_id,
      restaurant: {
        id: r.restaurant_id,
        name: r.restaurant_name,
        rating:
          r.restaurant_rating != null &&
          !Number.isNaN(Number(r.restaurant_rating))
            ? Number(r.restaurant_rating)
            : null,
      },
    };
  }

  /**
   * Popular: `is_popular` / `is_recommended` + `restaurant.popular_score`.
   * Does not sort by click_count or rating_count.
   */
  async getFeatured(query: DishGeoQueryDto = {}): Promise<DishDiscoveryRow[]> {
    const geo = this.parseGeo(query);
    const geoFilter = geo != null ? this.buildLocationFilter(geo) : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<
      (RawDishRow & { restaurant_popular_score: number | null })[]
    >(Prisma.sql`
      SELECT
        mi.id,
        mi.name,
        mi.price,
        mi.currency,
        mi.image_url,
        mi.is_popular,
        mi.is_recommended,
        COALESCE(mi.click_count, 0)::int AS click_count,
        ms.menu_id,
        r.id AS restaurant_id,
        r.name_default AS restaurant_name,
        r.rating AS restaurant_rating,
        r.popular_score AS restaurant_popular_score
      FROM menu_items mi
      INNER JOIN menu_sections ms ON mi.menu_section_id = ms.id
      INNER JOIN menus m ON ms.menu_id = m.id
      INNER JOIN restaurants r ON m.restaurant_id = r.id
      WHERE m.is_active = true
        AND mi.is_available = true
        AND (mi.is_popular = true OR mi.is_recommended = true)
        ${geoFilter}
      ORDER BY
        mi.is_popular DESC,
        mi.is_recommended DESC,
        r.popular_score DESC NULLS LAST,
        mi.id ASC
      LIMIT 10
    `);

    const mapped = rows.map((r) => this.mapRow(r));

    if (this.isDevDebug() && rows.length > 0) {
      this.logger.debug(
        `[popular] top → ${rows
          .map(
            (x) =>
              `id=${x.id} is_popular=${x.is_popular} restaurant_popular_score=${x.restaurant_popular_score ?? 'null'}`,
          )
          .join(' | ')}`,
      );
    }

    return mapped;
  }

  /**
   * Trending: click_count primary; tie-break updated_at, id.
   */
  async getTrending(query: DishGeoQueryDto = {}): Promise<DishDiscoveryRow[]> {
    const geo = this.parseGeo(query);
    const geoFilter = geo != null ? this.buildLocationFilter(geo) : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<RawDishRow[]>(Prisma.sql`
      SELECT
        mi.id,
        mi.name,
        mi.price,
        mi.currency,
        mi.image_url,
        mi.is_popular,
        mi.is_recommended,
        COALESCE(mi.click_count, 0)::int AS click_count,
        ms.menu_id,
        r.id AS restaurant_id,
        r.name_default AS restaurant_name,
        r.rating AS restaurant_rating
      FROM menu_items mi
      INNER JOIN menu_sections ms ON mi.menu_section_id = ms.id
      INNER JOIN menus m ON ms.menu_id = m.id
      INNER JOIN restaurants r ON m.restaurant_id = r.id
      WHERE m.is_active = true
        AND mi.is_available = true
        ${geoFilter}
      ORDER BY
        COALESCE(mi.click_count, 0) DESC,
        mi.updated_at DESC,
        mi.id ASC
      LIMIT 10
    `);

    const mapped = rows.map((r) => this.mapRow(r));

    if (this.isDevDebug() && mapped.length > 0) {
      this.logger.debug(
        `[trending] top → ${mapped.map((d) => `id=${d.id} click_count=${d.click_count}`).join(' | ')}`,
      );
    }

    return mapped;
  }
}
