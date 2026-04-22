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

/** Menu-item candidates before in-memory geo blend. */
const DISH_GEO_BLEND_POOL = 64;

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
  /** Present when featured/trending queries include geo bias or strict radius. */
  rest_dist_km?: number;
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

  /** Prefer nearer rows in the SQL pool so local candidates survive before in-memory blend. */
  private dishPoolDistanceOrderSql(useGeo: boolean): Prisma.Sql {
    return useGeo
      ? Prisma.sql`, rest_dist_km ASC NULLS LAST`
      : Prisma.sql``;
  }

  /** km from restaurant to point — used for blended ranking (bias / strict). */
  private dishRestDistanceKmSelectSql(lat: number, lng: number): Prisma.Sql {
    return Prisma.sql`, (
      CASE
        WHEN r.geom IS NOT NULL THEN ST_Distance(
          r.geom::geography,
          ST_SetSRID(ST_MakePoint(${lng}::double precision, ${lat}::double precision), 4326)::geography
        )::double precision / 1000.0
        WHEN r.latitude IS NOT NULL AND r.longitude IS NOT NULL THEN
          (6371.0 * acos(LEAST(1.0::double precision, GREATEST(-1.0::double precision,
            cos(radians(${lat}::double precision)) * cos(radians(r.latitude::double precision))
            * cos(radians(r.longitude::double precision) - radians(${lng}::double precision))
            + sin(radians(${lat}::double precision)) * sin(radians(r.latitude::double precision))
          ))))::double precision
        ELSE 6000.0::double precision
      END
    ) AS rest_dist_km`;
  }

  private dishProximity(distKm: number, dRefKm: number): number {
    return 1 / (1 + distKm / dRefKm);
  }

  private featuredDishBlendParts(
    row: RawDishRow & { restaurant_popular_score?: number | null },
    geoKind: 'bias' | 'strict',
  ): {
    baseSection: number;
    distanceKm: number;
    proximity: number;
    blend: number;
  } {
    const dist = row.rest_dist_km ?? 6000;
    const pop = Number(row.restaurant_popular_score ?? 0);
    const flags =
      (row.is_popular ? 0.45 : 0) + (row.is_recommended ? 0.3 : 0);
    const secPart = Math.log1p(Math.max(0, pop));
    if (geoKind === 'strict') {
      const dRef = 1.05;
      const wProx = 0.93;
      const wSec = 1 - wProx;
      const proximity = this.dishProximity(dist, dRef);
      const blend = wSec * secPart + wProx * proximity + flags;
      return { baseSection: pop, distanceKm: dist, proximity, blend };
    }
    const dRef = 6;
    const wProx = 0.82;
    const wSec = 1 - wProx;
    const proximity = this.dishProximity(dist, dRef);
    const blend = wSec * secPart + wProx * proximity + flags;
    return { baseSection: pop, distanceKm: dist, proximity, blend };
  }

  private featuredDishBlend(
    row: RawDishRow & { restaurant_popular_score?: number | null },
    geoKind: 'bias' | 'strict',
  ): number {
    return this.featuredDishBlendParts(row, geoKind).blend;
  }

  private trendingDishBlendParts(
    row: RawDishRow,
    geoKind: 'bias' | 'strict',
  ): {
    baseSection: number;
    distanceKm: number;
    proximity: number;
    blend: number;
  } {
    const dist = row.rest_dist_km ?? 6000;
    const clicks = row.click_count ?? 0;
    const secPart = Math.log1p(Math.max(0, clicks));
    if (geoKind === 'strict') {
      const dRef = 0.85;
      const wProx = 0.95;
      const wSec = 1 - wProx;
      const proximity = this.dishProximity(dist, dRef);
      const blend = wSec * secPart + wProx * proximity;
      return { baseSection: clicks, distanceKm: dist, proximity, blend };
    }
    const dRef = 5.5;
    const wProx = 0.85;
    const wSec = 1 - wProx;
    const proximity = this.dishProximity(dist, dRef);
    const blend = wSec * secPart + wProx * proximity;
    return { baseSection: clicks, distanceKm: dist, proximity, blend };
  }

  private trendingDishBlend(row: RawDishRow, geoKind: 'bias' | 'strict'): number {
    return this.trendingDishBlendParts(row, geoKind).blend;
  }

  private logDishBlendDebug(
    kind: 'featured' | 'trending',
    mode: 'none' | 'bias' | 'strict',
    rows: RawDishRow[],
  ): void {
    if (!this.isDevDebug() || rows.length === 0 || mode === 'none') return;
    const geoKind = mode === 'strict' ? 'strict' : 'bias';
    const top = rows.slice(0, 10);
    const section =
      kind === 'featured' ? 'featured_dishes' : 'trending_dishes';
    this.logger.log(
      JSON.stringify({
        tag: 'dishes_ranking_blend',
        section,
        kind,
        mode,
        top10: top.map((r) => {
          const p =
            kind === 'featured'
              ? this.featuredDishBlendParts(
                  r as RawDishRow & {
                    restaurant_popular_score?: number | null;
                  },
                  geoKind,
                )
              : this.trendingDishBlendParts(r, geoKind);
          return {
            id: r.id,
            restId: r.restaurant_id,
            distance_km: Number(p.distanceKm.toFixed(2)),
            baseSection: Number(p.baseSection),
            blend: Number(p.blend.toFixed(4)),
          };
        }),
      }),
    );
  }

  private parseDishRestDistKm<
    T extends { rest_dist_km?: unknown },
  >(rows: T[]): (T & { rest_dist_km?: number })[] {
    return rows.map((r) => {
      const v = r.rest_dist_km;
      const n =
        v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined;
      return { ...r, rest_dist_km: n };
    });
  }

  /** Comma-separated cuisine tags → trimmed, de-duped array. */
  private parseCuisineList(query: DishGeoQueryDto): string[] {
    const raw = query.cuisine?.trim();
    if (!raw) return [];
    return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))].slice(0, 20);
  }

  /**
   * SQL filter: restaurant must have at least one of the given cuisine tags.
   * `restaurants.cuisine_tags` is stored as a TEXT[] column.
   */
  private buildCuisineFilter(tags: string[]): Prisma.Sql {
    if (tags.length === 0) return Prisma.sql``;
    const clauses = tags.map(
      (t) => Prisma.sql`EXISTS (SELECT 1 FROM unnest(r.cuisine_tags) AS ct WHERE LOWER(TRIM(ct)) = LOWER(${t}))`,
    );
    if (clauses.length === 1) return Prisma.sql`AND ${clauses[0]}`;
    return Prisma.sql`AND (${Prisma.join(clauses, ' OR ')})`;
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
   * With lat/lng (bias or strict), blends distance into ranking so local results surface.
   */
  async getFeatured(query: DishGeoQueryDto = {}): Promise<DishDiscoveryRow[]> {
    const strictGeo = this.parseStrictGeo(query);
    const biasPoint = this.parseBiasPoint(query);
    const geoFilter =
      strictGeo != null ? this.buildLocationFilter(strictGeo) : Prisma.sql``;
    const districtNames = this.parseDistrictList(query);
    const districtFilter = this.buildDistrictFilter(districtNames);
    const cuisineTags = this.parseCuisineList(query);
    const cuisineFilter = this.buildCuisineFilter(cuisineTags);
    const geoLat = strictGeo?.lat ?? biasPoint?.lat;
    const geoLng = strictGeo?.lng ?? biasPoint?.lng;
    const useDishGeoBlend = geoLat != null && geoLng != null;
    const distSelect = useDishGeoBlend
      ? this.dishRestDistanceKmSelectSql(geoLat, geoLng)
      : Prisma.sql``;
    const blendMode: 'none' | 'bias' | 'strict' = strictGeo
      ? 'strict'
      : useDishGeoBlend
        ? 'bias'
        : 'none';
    const poolLimit = useDishGeoBlend ? DISH_GEO_BLEND_POOL : 10;
    const dishGeoKind: 'bias' | 'strict' =
      blendMode === 'strict' ? 'strict' : 'bias';

    if (this.isDevDebug()) {
      this.logger.log(
        `[dish-district-debug] featured districtRaw=${query.district ?? '∅'} districtParsed=${JSON.stringify(districtNames)} cuisineRaw=${query.cuisine ?? '∅'} strictGeo=${strictGeo != null} bias=${biasPoint != null} blendMode=${blendMode}`,
      );
    }

    let fallbackRows = await this.prisma.$queryRaw<
      (RawDishRow & { restaurant_popular_score: number | null; rest_dist_km?: unknown })[]
    >(Prisma.sql`
      SELECT
        mi.id,
        mi.name,
        mi.price,
        mi.currency,
        COALESCE(ma.secure_url, mi.image_url) AS image_url,
        mi.is_popular,
        mi.is_recommended,
        COALESCE(mi.click_count, 0)::int AS click_count,
        ms.menu_id,
        r.id AS restaurant_id,
        r.name_default AS restaurant_name,
        r.rating AS restaurant_rating,
        r.popular_score AS restaurant_popular_score
        ${distSelect}
      FROM menu_items mi
      LEFT JOIN media_assets ma ON ma.id = mi.media_asset_id
      INNER JOIN menu_sections ms ON mi.menu_section_id = ms.id
      INNER JOIN menus m ON ms.menu_id = m.id
      INNER JOIN restaurants r ON m.restaurant_id = r.id
      WHERE m.is_active = true
        AND mi.is_available = true
        AND (mi.is_popular = true OR mi.is_recommended = true)
        ${geoFilter}
        ${districtFilter}
        ${cuisineFilter}
      ORDER BY
        mi.is_popular DESC,
        mi.is_recommended DESC,
        r.popular_score DESC NULLS LAST
        ${this.dishPoolDistanceOrderSql(useDishGeoBlend)},
        mi.id ASC
      LIMIT ${poolLimit}
    `);

    if (fallbackRows.length === 0) {
      fallbackRows = await this.prisma.$queryRaw<
        (RawDishRow & { restaurant_popular_score: number | null; rest_dist_km?: unknown })[]
      >(Prisma.sql`
        SELECT
          mi.id,
          mi.name,
          mi.price,
          mi.currency,
          COALESCE(ma.secure_url, mi.image_url) AS image_url,
          mi.is_popular,
          mi.is_recommended,
          COALESCE(mi.click_count, 0)::int AS click_count,
          ms.menu_id,
          r.id AS restaurant_id,
          r.name_default AS restaurant_name,
          r.rating AS restaurant_rating,
          r.popular_score AS restaurant_popular_score
          ${distSelect}
        FROM menu_items mi
        LEFT JOIN media_assets ma ON ma.id = mi.media_asset_id
        INNER JOIN menu_sections ms ON mi.menu_section_id = ms.id
        INNER JOIN menus m ON ms.menu_id = m.id
        INNER JOIN restaurants r ON m.restaurant_id = r.id
        WHERE m.is_active = true
          AND mi.is_available = true
          ${geoFilter}
          ${districtFilter}
          ${cuisineFilter}
        ORDER BY
          r.rating DESC NULLS LAST,
          r.popular_score DESC NULLS LAST
          ${this.dishPoolDistanceOrderSql(useDishGeoBlend)},
          mi.id ASC
        LIMIT ${poolLimit}
      `);
    }

    if (this.isDevDebug() && strictGeo != null) {
      this.logger.log(
        JSON.stringify({
          tag: 'dishes_strict_nearby_debug',
          section: 'featured_dishes',
          lat: strictGeo.lat,
          lng: strictGeo.lng,
          radius_km: strictGeo.radiusM / 1000,
          poolRowCount: fallbackRows.length,
        }),
      );
    }

    let parsed = this.parseDishRestDistKm(fallbackRows);
    if (useDishGeoBlend && parsed.length > 1) {
      parsed.sort(
        (a, b) =>
          this.featuredDishBlend(b, dishGeoKind) -
          this.featuredDishBlend(a, dishGeoKind),
      );
      this.logDishBlendDebug('featured', blendMode, parsed);
    }
    parsed = parsed.slice(0, 10);

    if (this.isDevDebug() && parsed.length > 0) {
      this.logger.debug(
        `[popular] top → ${parsed
          .map(
            (x) =>
              `id=${x.id} is_popular=${x.is_popular} restaurant_popular_score=${x.restaurant_popular_score ?? 'null'}`,
          )
          .join(' | ')}`,
      );
    }

    return parsed.map((r) => this.mapRow(r));
  }

  /**
   * Trending: click_count primary; with geo, blends distance so nearby trending surfaces.
   */
  async getTrending(query: DishGeoQueryDto = {}): Promise<DishDiscoveryRow[]> {
    const strictGeo = this.parseStrictGeo(query);
    const biasPoint = this.parseBiasPoint(query);
    const geoFilter =
      strictGeo != null ? this.buildLocationFilter(strictGeo) : Prisma.sql``;
    const districtNames = this.parseDistrictList(query);
    const districtFilter = this.buildDistrictFilter(districtNames);
    const cuisineTags = this.parseCuisineList(query);
    const cuisineFilter = this.buildCuisineFilter(cuisineTags);
    const geoLat = strictGeo?.lat ?? biasPoint?.lat;
    const geoLng = strictGeo?.lng ?? biasPoint?.lng;
    const useDishGeoBlend = geoLat != null && geoLng != null;
    const distSelect = useDishGeoBlend
      ? this.dishRestDistanceKmSelectSql(geoLat, geoLng)
      : Prisma.sql``;
    const blendMode: 'none' | 'bias' | 'strict' = strictGeo
      ? 'strict'
      : useDishGeoBlend
        ? 'bias'
        : 'none';
    const poolLimit = useDishGeoBlend ? DISH_GEO_BLEND_POOL : 10;
    const dishGeoKind: 'bias' | 'strict' =
      blendMode === 'strict' ? 'strict' : 'bias';

    if (this.isDevDebug()) {
      this.logger.log(
        `[dish-district-debug] trending districtRaw=${query.district ?? '∅'} districtParsed=${JSON.stringify(districtNames)} cuisineRaw=${query.cuisine ?? '∅'} strictGeo=${strictGeo != null} bias=${biasPoint != null} blendMode=${blendMode}`,
      );
    }

    let fallbackRows = await this.prisma.$queryRaw<
      (RawDishRow & { rest_dist_km?: unknown })[]
    >(Prisma.sql`
      SELECT
        mi.id,
        mi.name,
        mi.price,
        mi.currency,
        COALESCE(ma.secure_url, mi.image_url) AS image_url,
        mi.is_popular,
        mi.is_recommended,
        COALESCE(mi.click_count, 0)::int AS click_count,
        ms.menu_id,
        r.id AS restaurant_id,
        r.name_default AS restaurant_name,
        r.rating AS restaurant_rating
        ${distSelect}
      FROM menu_items mi
      LEFT JOIN media_assets ma ON ma.id = mi.media_asset_id
      INNER JOIN menu_sections ms ON mi.menu_section_id = ms.id
      INNER JOIN menus m ON ms.menu_id = m.id
      INNER JOIN restaurants r ON m.restaurant_id = r.id
      WHERE m.is_active = true
        AND mi.is_available = true
        ${geoFilter}
        ${districtFilter}
        ${cuisineFilter}
      ORDER BY
        COALESCE(mi.click_count, 0) DESC,
        mi.updated_at DESC
        ${this.dishPoolDistanceOrderSql(useDishGeoBlend)},
        mi.id ASC
      LIMIT ${poolLimit}
    `);

    if (fallbackRows.length === 0) {
      fallbackRows = await this.prisma.$queryRaw<
        (RawDishRow & { rest_dist_km?: unknown })[]
      >(Prisma.sql`
        SELECT
          mi.id,
          mi.name,
          mi.price,
          mi.currency,
          COALESCE(ma.secure_url, mi.image_url) AS image_url,
          mi.is_popular,
          mi.is_recommended,
          COALESCE(mi.click_count, 0)::int AS click_count,
          ms.menu_id,
          r.id AS restaurant_id,
          r.name_default AS restaurant_name,
          r.rating AS restaurant_rating
          ${distSelect}
        FROM menu_items mi
        LEFT JOIN media_assets ma ON ma.id = mi.media_asset_id
        INNER JOIN menu_sections ms ON mi.menu_section_id = ms.id
        INNER JOIN menus m ON ms.menu_id = m.id
        INNER JOIN restaurants r ON m.restaurant_id = r.id
        WHERE m.is_active = true
          AND mi.is_available = true
          ${geoFilter}
          ${districtFilter}
          ${cuisineFilter}
        ORDER BY
          r.rating DESC NULLS LAST,
          COALESCE(mi.click_count, 0) DESC
          ${this.dishPoolDistanceOrderSql(useDishGeoBlend)},
          mi.id ASC
        LIMIT ${poolLimit}
      `);
    }

    if (this.isDevDebug() && strictGeo != null) {
      this.logger.log(
        JSON.stringify({
          tag: 'dishes_strict_nearby_debug',
          section: 'trending_dishes',
          lat: strictGeo.lat,
          lng: strictGeo.lng,
          radius_km: strictGeo.radiusM / 1000,
          poolRowCount: fallbackRows.length,
        }),
      );
    }

    let parsed = this.parseDishRestDistKm(fallbackRows);
    if (useDishGeoBlend && parsed.length > 1) {
      parsed.sort(
        (a, b) =>
          this.trendingDishBlend(b, dishGeoKind) -
          this.trendingDishBlend(a, dishGeoKind),
      );
      this.logDishBlendDebug('trending', blendMode, parsed);
    }
    parsed = parsed.slice(0, 10);

    const mapped = parsed.map((r) => this.mapRow(r));

    if (this.isDevDebug() && mapped.length > 0) {
      this.logger.debug(
        `[trending] top → ${mapped.map((d) => `id=${d.id} click_count=${d.click_count}`).join(' | ')}`,
      );
    }

    return mapped;
  }

  /**
   * Location-aware dish search filtered by cuisine tags.
   * Used by the homepage when a category filter is selected.
   * Falls back to all available dishes if no geo is provided.
   */
  async getNearby(query: DishGeoQueryDto = {}): Promise<DishDiscoveryRow[]> {
    const strictGeo = this.parseStrictGeo(query);
    const biasPoint = this.parseBiasPoint(query);
    const geoFilter =
      strictGeo != null ? this.buildLocationFilter(strictGeo) : Prisma.sql``;
    const districtNames = this.parseDistrictList(query);
    const districtFilter = this.buildDistrictFilter(districtNames);
    const cuisineTags = this.parseCuisineList(query);
    const cuisineFilter = this.buildCuisineFilter(cuisineTags);

    const geoLat = strictGeo?.lat ?? biasPoint?.lat;
    const geoLng = strictGeo?.lng ?? biasPoint?.lng;
    const useDishGeoBlend = geoLat != null && geoLng != null;
    const distSelect = useDishGeoBlend
      ? this.dishRestDistanceKmSelectSql(geoLat, geoLng)
      : Prisma.sql``;
    const blendMode: 'none' | 'bias' | 'strict' = strictGeo
      ? 'strict'
      : useDishGeoBlend
        ? 'bias'
        : 'none';
    const poolLimit = useDishGeoBlend ? DISH_GEO_BLEND_POOL : 20;
    const dishGeoKind: 'bias' | 'strict' =
      blendMode === 'strict' ? 'strict' : 'bias';

    const rows = await this.prisma.$queryRaw<
      (RawDishRow & { restaurant_popular_score: number | null; rest_dist_km?: unknown })[]
    >(Prisma.sql`
      SELECT
        mi.id,
        mi.name,
        mi.price,
        mi.currency,
        COALESCE(ma.secure_url, mi.image_url) AS image_url,
        mi.is_popular,
        mi.is_recommended,
        COALESCE(mi.click_count, 0)::int AS click_count,
        ms.menu_id,
        r.id AS restaurant_id,
        r.name_default AS restaurant_name,
        r.rating AS restaurant_rating,
        r.popular_score AS restaurant_popular_score
        ${distSelect}
      FROM menu_items mi
      LEFT JOIN media_assets ma ON ma.id = mi.media_asset_id
      INNER JOIN menu_sections ms ON mi.menu_section_id = ms.id
      INNER JOIN menus m ON ms.menu_id = m.id
      INNER JOIN restaurants r ON m.restaurant_id = r.id
      WHERE m.is_active = true
        AND mi.is_available = true
        ${geoFilter}
        ${districtFilter}
        ${cuisineFilter}
      ORDER BY
        mi.is_popular DESC,
        mi.is_recommended DESC,
        r.popular_score DESC NULLS LAST
        ${this.dishPoolDistanceOrderSql(useDishGeoBlend)},
        mi.id ASC
      LIMIT ${poolLimit}
    `);

    let parsed = this.parseDishRestDistKm(rows);
    if (useDishGeoBlend && parsed.length > 1) {
      parsed.sort(
        (a, b) =>
          this.featuredDishBlend(b, dishGeoKind) -
          this.featuredDishBlend(a, dishGeoKind),
      );
    }

    return parsed.slice(0, 16).map((r) => this.mapRow(r));
  }
}
