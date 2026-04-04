import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SRI_LANKA_DISTRICTS } from '../locations/data/sri-lanka-districts';
import type { DishGeoQueryDto } from './dto/dish-geo.query.dto';

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

  /** Strict ST_DWithin filter — requires radius_km (Nearby mode). */
  private parseStrictGeo(
    query: DishGeoQueryDto,
  ): { lat: number; lng: number; radiusM: number } | null {
    const latRaw = query.lat?.trim();
    const lngRaw = query.lng?.trim();
    const radiusRaw = query.radius_km?.trim();
    if (!latRaw || !lngRaw || !radiusRaw) {
      return null;
    }

    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      throw new BadRequestException('Invalid lat');
    }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      throw new BadRequestException('Invalid lng');
    }

    const radiusKm = parseFloat(radiusRaw);
    if (Number.isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
      throw new BadRequestException(
        'radius_km must be a number between 0 and 500',
      );
    }

    return { lat, lng, radiusM: radiusKm * 1000 };
  }

  /** Lat/lng only: bias ordering, no radius filter (default homepage mode). */
  private parseBiasPoint(query: DishGeoQueryDto): { lat: number; lng: number } | null {
    const latRaw = query.lat?.trim();
    const lngRaw = query.lng?.trim();
    const radiusRaw = query.radius_km?.trim();
    if (!latRaw || !lngRaw || radiusRaw) {
      return null;
    }
    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      return null;
    }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      return null;
    }
    return { lat, lng };
  }

  /** Secondary sort: prefer restaurants closer to the user when geom exists. */
  private dishBiasOrderSql(p: { lat: number; lng: number }): Prisma.Sql {
    return Prisma.sql`, (CASE WHEN r.geom IS NOT NULL THEN ST_Distance(r.geom::geography, ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography)::double precision ELSE 1e15::double precision END) ASC NULLS LAST`;
  }

  /** Same parsing as restaurant search: comma-separated, trimmed, de-duped. */
  private parseDistrictList(query: DishGeoQueryDto): string[] {
    const raw = query.district?.trim();
    if (!raw) return [];
    return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))].slice(
      0,
      40,
    );
  }

  /**
   * Match `restaurants.district` whether it stores display name ("Nuwara Eliya") or slug ("nuwara-eliya").
   * Homepage filters use display names from GET /districts.
   */
  private buildDistrictFilter(names: string[]): Prisma.Sql {
    if (names.length === 0) return Prisma.sql``;
    const clauses: Prisma.Sql[] = [];
    for (const raw of names) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      const canon = SRI_LANKA_DISTRICTS.find(
        (d) => d.name.toLowerCase() === lower || d.id === lower,
      );
      if (canon) {
        clauses.push(
          Prisma.sql`(LOWER(TRIM(COALESCE(r.district, ''))) = LOWER(${canon.name}) OR LOWER(TRIM(COALESCE(r.district, ''))) = LOWER(${canon.id}))`,
        );
      } else {
        clauses.push(
          Prisma.sql`LOWER(TRIM(COALESCE(r.district, ''))) = LOWER(${trimmed})`,
        );
      }
    }
    if (clauses.length === 0) return Prisma.sql``;
    if (clauses.length === 1) {
      return Prisma.sql`AND ${clauses[0]}`;
    }
    return Prisma.sql`AND (${Prisma.join(clauses, ' OR ')})`;
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
    const strictGeo = this.parseStrictGeo(query);
    const biasPoint = this.parseBiasPoint(query);
    const geoFilter =
      strictGeo != null ? this.buildLocationFilter(strictGeo) : Prisma.sql``;
    const biasOrder =
      biasPoint != null ? this.dishBiasOrderSql(biasPoint) : Prisma.sql``;
    const districtNames = this.parseDistrictList(query);
    const districtFilter = this.buildDistrictFilter(districtNames);
    if (this.isDevDebug()) {
      this.logger.log(
        `[dish-district-debug] featured districtRaw=${query.district ?? '∅'} districtParsed=${JSON.stringify(districtNames)} strictGeo=${strictGeo != null} bias=${biasPoint != null}`,
      );
    }

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
        ${districtFilter}
      ORDER BY
        mi.is_popular DESC,
        mi.is_recommended DESC${biasOrder},
        r.popular_score DESC NULLS LAST,
        mi.id ASC
      LIMIT 10
    `);

    let fallbackRows = rows;
    if (fallbackRows.length === 0) {
      // Fallback: if metrics/flags are sparse, return top dishes by restaurant rating/popularity.
      fallbackRows = await this.prisma.$queryRaw<
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
          ${geoFilter}
          ${districtFilter}
        ORDER BY
          r.rating DESC NULLS LAST${biasOrder},
          r.popular_score DESC NULLS LAST,
          mi.id ASC
        LIMIT 10
      `);
    }

    if (fallbackRows.length === 0 && strictGeo != null) {
      fallbackRows = await this.prisma.$queryRaw<
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
          ${districtFilter}
        ORDER BY
          r.rating DESC NULLS LAST,
          r.popular_score DESC NULLS LAST,
          mi.id ASC
        LIMIT 10
      `);
    }

    const mapped = fallbackRows.map((r) => this.mapRow(r));

    if (this.isDevDebug() && fallbackRows.length > 0) {
      this.logger.debug(
        `[popular] top → ${fallbackRows
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
    const strictGeo = this.parseStrictGeo(query);
    const biasPoint = this.parseBiasPoint(query);
    const geoFilter =
      strictGeo != null ? this.buildLocationFilter(strictGeo) : Prisma.sql``;
    const biasOrder =
      biasPoint != null ? this.dishBiasOrderSql(biasPoint) : Prisma.sql``;
    const districtNames = this.parseDistrictList(query);
    const districtFilter = this.buildDistrictFilter(districtNames);
    if (this.isDevDebug()) {
      this.logger.log(
        `[dish-district-debug] trending districtRaw=${query.district ?? '∅'} districtParsed=${JSON.stringify(districtNames)} strictGeo=${strictGeo != null} bias=${biasPoint != null}`,
      );
    }

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
        ${districtFilter}
      ORDER BY
        COALESCE(mi.click_count, 0) DESC${biasOrder},
        mi.updated_at DESC,
        mi.id ASC
      LIMIT 10
    `);

    let fallbackRows = rows;
    if (fallbackRows.length === 0) {
      fallbackRows = await this.prisma.$queryRaw<RawDishRow[]>(Prisma.sql`
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
          ${districtFilter}
        ORDER BY
          r.rating DESC NULLS LAST${biasOrder},
          COALESCE(mi.click_count, 0) DESC,
          mi.id ASC
        LIMIT 10
      `);
    }

    if (fallbackRows.length === 0 && strictGeo != null) {
      fallbackRows = await this.prisma.$queryRaw<RawDishRow[]>(Prisma.sql`
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
          ${districtFilter}
        ORDER BY
          r.rating DESC NULLS LAST,
          COALESCE(mi.click_count, 0) DESC,
          mi.id ASC
        LIMIT 10
      `);
    }

    const mapped = fallbackRows.map((r) => this.mapRow(r));

    if (this.isDevDebug() && mapped.length > 0) {
      this.logger.debug(
        `[trending] top → ${mapped.map((d) => `id=${d.id} click_count=${d.click_count}`).join(' | ')}`,
      );
    }

    return mapped;
  }
}
