import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { CacheService } from '../cache/cache.service';
import {
  buildRestaurantsListCacheKey,
  CACHE_KEY_RESTAURANT,
  CACHE_PATTERN_RESTAURANTS_LIST,
  CACHE_TTL_ENTITY,
  CACHE_TTL_RANKING_POPULAR_TOP_RATED,
  CACHE_TTL_RANKING_TRENDING,
  DEFAULT_TTL_RESTAURANTS_DISCOVERY,
  DEFAULT_TTL_RESTAURANTS_LIST,
  DEFAULT_TTL_RESTAURANTS_NEARBY,
  MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS,
} from '../cache/cache-keys';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { RankingService } from '../ranking/ranking.service';
import type { RestaurantSortMode } from '../ranking/ranking.types';
import { RESTAURANT_LIST_SELECT } from './restaurant-list.select';
import {
  SearchRestaurantsDto,
  firstQueryString,
  validateRestaurantSearchGeoFields,
} from './dto/search-restaurants.dto';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';

const SELECT_RESTAURANT = RESTAURANT_LIST_SELECT;

/** Default page size; max enforced for scalability (offset pagination). */
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

/** Great-circle distance for bias ordering (lat/lng without radius filter). */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Cap in-memory geo+ranking blend (ordered fetch = global section sort).
 * Slightly below old 2500: keeps latency bounded; blend weights do most local work.
 */
const RANKING_GEO_BLEND_MAX_ROWS = 1600;

/** 0..1 — higher when closer to the user. `dRefKm` scales decay (smaller = more local). */
function proximityFactor(distanceKm: number | undefined, dRefKm: number): number {
  if (distanceKm == null || !Number.isFinite(distanceKm)) {
    return 0.06;
  }
  return 1 / (1 + distanceKm / dRefKm);
}

function sectionSignalForSort(
  row: {
    rating: number | null;
    popular_score?: number | null;
    trending_score?: number | null;
  },
  sortMode: RestaurantSortMode,
): number {
  switch (sortMode) {
    case 'popular':
      return row.popular_score ?? 0;
    case 'trending':
      return row.trending_score ?? 0;
    case 'top_rated':
      return Number(row.rating) || 0;
    default:
      return 0;
  }
}

type RestaurantRankingBlendParts = {
  baseSection: number;
  normSection: number;
  distanceKm: number | null;
  proximity: number;
  blend: number;
};

/**
 * Blend section identity (popular / trending / top_rated) with proximity.
 * Tuned for stronger locality: steeper distance decay + higher proximity weight.
 * `top_rated` uses scaled norm so small rating gaps still compete with distance.
 */
function computeRestaurantRankingBlend(
  sortMode: RestaurantSortMode,
  row: {
    rating: number | null;
    popular_score?: number | null;
    trending_score?: number | null;
  },
  distanceKm: number | undefined,
  geoKind: 'bias' | 'strict',
): RestaurantRankingBlendParts {
  const baseSection = sectionSignalForSort(row, sortMode);
  let normSection = Math.log1p(Math.max(0, baseSection));
  if (sortMode === 'top_rated') {
    normSection = Math.log1p(Math.max(0, baseSection) * 8);
  }
  const dRef = geoKind === 'strict' ? 3 : 14;
  const proximity = proximityFactor(distanceKm, dRef);
  const wProx = geoKind === 'strict' ? 0.78 : 0.7;
  const wSec = 1 - wProx;
  const blend = wSec * normSection + wProx * proximity;
  return {
    baseSection,
    normSection,
    distanceKm:
      distanceKm != null && Number.isFinite(distanceKm) ? distanceKm : null,
    proximity,
    blend,
  };
}

export type RestaurantsSearchResult = {
  data: ((typeof SELECT_RESTAURANT extends infer S
    ? { [K in keyof S]: S[K] }
    : never) & { distance_km?: number })[];
  page: number;
  pagesize: number;
  total: number;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

/** Reject poisoned / stale cache entries that are not a full list response. */
function isValidCachedListResult(value: unknown): value is RestaurantsSearchResult {
  if (value == null || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  if (!Array.isArray(o.data)) return false;
  if (typeof o.page !== 'number' || !Number.isFinite(o.page)) return false;
  if (typeof o.pagesize !== 'number' || !Number.isFinite(o.pagesize)) return false;
  if (typeof o.total !== 'number' || !Number.isFinite(o.total)) return false;
  if (o.meta == null || typeof o.meta !== 'object') return false;
  const m = o.meta as Record<string, unknown>;
  if (typeof m.total !== 'number' || !Number.isFinite(m.total)) return false;
  if (typeof m.page !== 'number' || !Number.isFinite(m.page)) return false;
  if (typeof m.limit !== 'number' || !Number.isFinite(m.limit)) return false;
  if (typeof m.totalPages !== 'number' || !Number.isFinite(m.totalPages)) return false;
  return true;
}

@Injectable()
export class RestaurantsService implements OnModuleInit {
  private readonly logger = new Logger(RestaurantsService.name);

  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
    private cache: CacheService,
    private config: ConfigService,
    private rankingService: RankingService,
  ) {}

  /** TODO(geo): remove after confirming production runs current source (not stale dist). */
  onModuleInit(): void {
    this.logger.log('NEW GEO VALIDATION ACTIVE');
  }

  /** `limit` wins over legacy `pagesize`. Clamped to [1, MAX_PAGE_SIZE]. */
  private resolvePageSize(dto: SearchRestaurantsDto): number {
    const raw = (dto.limit?.trim() || dto.pagesize?.trim() || String(DEFAULT_PAGE_SIZE)).trim();
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return DEFAULT_PAGE_SIZE;
    return Math.min(Math.max(n, 1), MAX_PAGE_SIZE);
  }

  private wrapSearchResult(
    page: number,
    pageSize: number,
    total: number,
    data: unknown[],
  ): RestaurantsSearchResult {
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    return {
      data: data as RestaurantsSearchResult['data'],
      page,
      pagesize: pageSize,
      total,
      meta: {
        total,
        page,
        limit: pageSize,
        totalPages,
      },
    };
  }

  /**
   * TTL for list cache: nearby (geo) shortest; first-page discovery batch (limit 50, no q) longest; else default list.
   */
  private resolveListCacheTtl(
    dto: SearchRestaurantsDto,
    page: number,
    pageSize: number,
    hasFullLocation: boolean,
  ): number {
    const read = (key: string, fallback: number): number => {
      const v = this.config.get<string | number>(key);
      if (v == null || v === '') return fallback;
      const num = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(num) && num > 0 ? num : fallback;
    };
    const nearby = read(
      'CACHE_TTL_RESTAURANTS_NEARBY',
      DEFAULT_TTL_RESTAURANTS_NEARBY,
    );
    const general = read(
      'CACHE_TTL_RESTAURANTS_LIST',
      DEFAULT_TTL_RESTAURANTS_LIST,
    );
    const discovery = read(
      'CACHE_TTL_RESTAURANTS_DISCOVERY',
      DEFAULT_TTL_RESTAURANTS_DISCOVERY,
    );
    const sortKey = dto.sort?.trim();
    if (
      sortKey === 'popular' ||
      sortKey === 'top_rated' ||
      sortKey === 'rating'
    ) {
      return Math.min(
        CACHE_TTL_RANKING_POPULAR_TOP_RATED,
        MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS,
      );
    }
    if (sortKey === 'trending') {
      return Math.min(
        CACHE_TTL_RANKING_TRENDING,
        MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS,
      );
    }

    let ttl: number;
    if (hasFullLocation) ttl = nearby;
    else if (page === 1 && pageSize === 50 && !dto.q?.trim()) ttl = discovery;
    else ttl = general;
    return Math.min(ttl, MAX_RESTAURANTS_LIST_CACHE_TTL_SECONDS);
  }

  async search(dto: SearchRestaurantsDto): Promise<RestaurantsSearchResult> {
    const latP = firstQueryString(dto.lat);
    const lngP = firstQueryString(dto.lng);
    const radP = firstQueryString(dto.radius_km);
    const hasLat = !!latP;
    const hasLng = !!lngP;
    const hasRadius = !!radP;

    const geoCheck = validateRestaurantSearchGeoFields(dto);
    if (!geoCheck.ok) {
      throw new BadRequestException(geoCheck.message);
    }

    const strictGeo = !!(latP && lngP && radP);
    const biasGeo = !!(latP && lngP && !radP);
    const geoMode: 'bias' | 'strict' | 'none' = strictGeo
      ? 'strict'
      : biasGeo
        ? 'bias'
        : 'none';

    // TODO(geo): remove after verifying bias vs strict in production
    this.logger.log(
      JSON.stringify({
        tag: 'restaurants_search',
        route: 'GET /restaurants',
        hasLat,
        hasLng,
        hasRadius,
        sort: dto.sort ?? null,
        mode: geoMode,
      }),
    );

    const dtoForSearch = dto;

    const page = Math.max(parseInt(dtoForSearch.page ?? '1', 10), 1);
    const pageSize = this.resolvePageSize(dtoForSearch);
    const cacheKey = buildRestaurantsListCacheKey(dtoForSearch, page, pageSize);

    if (this.cache.isConfigured()) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        try {
          const parsed: unknown = JSON.parse(cached);
          if (isValidCachedListResult(parsed)) {
            return parsed;
          }
        } catch {
          // ignore parse error, fall through to DB
        }
      }
    }

    const result = await this.runRestaurantSearch(dtoForSearch, page, pageSize);

    if (this.cache.isConfigured()) {
      const ttl = this.resolveListCacheTtl(dtoForSearch, page, pageSize, strictGeo);
      await this.cache.set(cacheKey, JSON.stringify(result), ttl);
    }
    return result;
  }

  /** Core DB / Meilisearch query for GET /restaurants (no cache read/write). */
  private async runRestaurantSearch(
    dto: SearchRestaurantsDto,
    page: number,
    pageSize: number,
  ): Promise<RestaurantsSearchResult> {
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const latP = firstQueryString(dto.lat);
    const lngP = firstQueryString(dto.lng);
    const radP = firstQueryString(dto.radius_km);
    const strictGeo = !!(latP && lngP && radP);
    const biasGeo = !!(latP && lngP && !radP);

    let biasLat: number | undefined;
    let biasLng: number | undefined;

    let locationIds: number[] = [];
    let distanceById: Map<number, number> = new Map();

    if (strictGeo) {
      const lat = parseFloat(latP!);
      const lng = parseFloat(lngP!);
      const radiusKm = parseFloat(radP!);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new BadRequestException('Invalid lat');
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        throw new BadRequestException('Invalid lng');
      }
      if (isNaN(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
        throw new BadRequestException(
          'radius_km must be a number between 0 and 500',
        );
      }
      const radiusM = radiusKm * 1000;

      const rows = await this.prisma.$queryRaw<
        { id: number; distance_m: number | string }[]
      >(
        Prisma.sql`
          SELECT id, ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) as distance_m
          FROM restaurants
          WHERE geom IS NOT NULL
          AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusM})
        `,
      );
      locationIds = rows.map((r) => r.id);
      rows.forEach((r) => {
        const m = typeof r.distance_m === 'string' ? parseFloat(r.distance_m) : r.distance_m;
        distanceById.set(r.id, Number.isNaN(m) ? 0 : m / 1000);
      });
    } else if (biasGeo) {
      const lat = parseFloat(latP!);
      const lng = parseFloat(lngP!);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new BadRequestException('Invalid lat');
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        throw new BadRequestException('Invalid lng');
      }
      biasLat = lat;
      biasLng = lng;
    }

    const where: Prisma.restaurantsWhereInput = {};

    if (locationIds.length > 0) {
      where.id = { in: locationIds };
    }

    const qTrimmed = dto.q?.trim();
    let useMeilisearch =
      !!qTrimmed && this.searchService.isConfigured();
    let meiliCandidateIds: number[] | null = null;

    if (useMeilisearch) {
      try {
        const { ids: meiliIds } = await this.searchService.searchRestaurantIds(
          qTrimmed!,
          { limit: 2000 },
        );
        if (meiliIds.length === 0) {
          // Index empty / no Meili hits — fall back to DB so menu item names still match (e.g. "kottu").
          useMeilisearch = false;
          meiliCandidateIds = null;
        } else {
          // Restrict to location ids when doing "near me"
          meiliCandidateIds =
            locationIds.length > 0
              ? meiliIds.filter((id) => locationIds.includes(id))
              : meiliIds;
          if (meiliCandidateIds.length === 0) {
            // No Meili hits inside radius — fall back to DB text search within radius (dish names, etc.).
            useMeilisearch = false;
            meiliCandidateIds = null;
          } else {
            where.id = { in: meiliCandidateIds };
          }
        }
      } catch {
        useMeilisearch = false;
        meiliCandidateIds = null;
      }
    }

    if (!useMeilisearch && dto.q && qTrimmed) {
      // Text search: restaurant name/city/district or menu item name/description (Prisma fallback)
      where.OR = [
        { name_default: { contains: qTrimmed, mode: 'insensitive' } },
        { city: { contains: qTrimmed, mode: 'insensitive' } },
        { district: { contains: qTrimmed, mode: 'insensitive' } },
        {
          menus: {
            some: {
              is_active: true,
              menu_sections: {
                some: {
                  menu_items: {
                    some: {
                      OR: [
                        { name: { contains: qTrimmed, mode: 'insensitive' } },
                        {
                          description: {
                            contains: qTrimmed,
                            mode: 'insensitive',
                          },
                        },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      ];
    }

    // Filters
    if (dto.city) where.city = { equals: dto.city, mode: 'insensitive' };

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

    // District: one name or comma-separated OR (multi-select in clients)
    const districtParts = dto.district?.trim()
      ? [...new Set(dto.district.split(',').map((s) => s.trim()).filter(Boolean))]
      : [];
    if (districtParts.length === 1) {
      where.district = { equals: districtParts[0], mode: 'insensitive' };
    } else if (districtParts.length > 1) {
      const districtOr: Prisma.restaurantsWhereInput[] = districtParts.map((p) => ({
        district: { equals: p, mode: 'insensitive' },
      }));
      const keys = Object.keys(where).filter(
        (k) => (where as Record<string, unknown>)[k] !== undefined,
      );
      if (keys.length === 0) {
        where.OR = districtOr;
      } else {
        const prior = { ...where };
        for (const k of Object.keys(where)) {
          delete (where as Record<string, unknown>)[k];
        }
        where.AND = [prior, { OR: districtOr }];
      }
    }

    const hasTextQuery = !!qTrimmed;
    const strictGeoEffective = strictGeo && locationIds.length > 0;
    const sortMode = this.rankingService.resolveSortMode(
      dto,
      strictGeoEffective,
      biasGeo,
      hasTextQuery,
    );
    const orderBy = this.rankingService.getPrismaOrderBy(sortMode);
    if (this.rankingService.usesDbRankingSort(sortMode)) {
      this.rankingService.logRankingApplied(sortMode);
    }

    const useGeoDistanceSort =
      sortMode === 'distance' &&
      ((strictGeoEffective && distanceById.size > 0) ||
        (biasGeo && biasLat != null && biasLng != null));

    const useMeiliRelevanceOrder =
      useMeilisearch &&
      !!meiliCandidateIds &&
      !(strictGeo && distanceById.size > 0) &&
      sortMode === 'default_relevance';

    const useRankingGeoBlend =
      this.rankingService.usesDbRankingSort(sortMode) &&
      !useMeiliRelevanceOrder &&
      ((biasGeo && biasLat != null && biasLng != null) ||
        (strictGeoEffective && distanceById.size > 0));

    const fetchLargeList =
      useGeoDistanceSort || useMeiliRelevanceOrder || useRankingGeoBlend;

    const total = await this.prisma.restaurants.count({ where });

    const capRankingBlend =
      useRankingGeoBlend && total > RANKING_GEO_BLEND_MAX_ROWS;
    if (capRankingBlend) {
      this.logger.warn(
        `Restaurants ranking geo blend: capping candidates at ${RANKING_GEO_BLEND_MAX_ROWS} of ${total} rows`,
      );
    }

    let rows = fetchLargeList
      ? await this.prisma.restaurants.findMany({
          where,
          orderBy,
          select: SELECT_RESTAURANT,
          ...(capRankingBlend ? { take: RANKING_GEO_BLEND_MAX_ROWS } : {}),
        })
      : await this.prisma.restaurants.findMany({
          where,
          skip,
          take,
          orderBy,
          select: SELECT_RESTAURANT,
        });

    // If ranking signals are sparse and sorted result set is empty, fall back to a stable default list.
    let totalOut = total;
    if (
      totalOut === 0 &&
      (sortMode === 'popular' || sortMode === 'top_rated' || sortMode === 'trending')
    ) {
      const fallbackOrderBy = [{ created_at: 'desc' as const }, { id: 'asc' as const }];
      totalOut = await this.prisma.restaurants.count({ where });
      rows = await this.prisma.restaurants.findMany({
        where,
        skip,
        take,
        orderBy: fallbackOrderBy,
        select: SELECT_RESTAURANT,
      });
    }

    type ListRow = (typeof rows)[number] & { distance_km?: number };

    const attachDistance = (list: typeof rows): ListRow[] =>
      list.map((r) => {
        if (strictGeoEffective && distanceById.size > 0) {
          const dkm = distanceById.get(r.id);
          return dkm !== undefined ? { ...r, distance_km: dkm } : (r as ListRow);
        }
        if (
          biasGeo &&
          biasLat != null &&
          biasLng != null &&
          r.latitude != null &&
          r.longitude != null
        ) {
          return {
            ...r,
            distance_km: haversineKm(biasLat, biasLng, r.latitude, r.longitude),
          };
        }
        return r as ListRow;
      });

    let data: ListRow[];

    if (useGeoDistanceSort) {
      const withDistance = attachDistance(rows);
      withDistance.sort(
        (a, b) =>
          (a.distance_km ?? Number.POSITIVE_INFINITY) -
          (b.distance_km ?? Number.POSITIVE_INFINITY),
      );
      data = withDistance.slice(skip, skip + take);
    } else if (useRankingGeoBlend) {
      const geoKind: 'bias' | 'strict' = strictGeoEffective ? 'strict' : 'bias';
      const withDistance = attachDistance(rows);
      const scored = withDistance.map((r) => {
        const parts = computeRestaurantRankingBlend(
          sortMode,
          r,
          r.distance_km,
          geoKind,
        );
        return { r, score: parts.blend, parts };
      });
      scored.sort((a, b) => b.score - a.score);
      data = scored.map((s) => s.r).slice(skip, skip + take);

      if (process.env.NODE_ENV !== 'production') {
        const top = scored.slice(0, 10);
        this.logger.log(
          JSON.stringify({
            tag: 'restaurants_ranking_blend',
            mode: strictGeoEffective ? 'strict' : 'bias',
            sort: sortMode,
            top10: top.map((t) => ({
              id: t.r.id,
              baseSection: Number(t.parts.baseSection.toFixed(4)),
              normSection: Number(t.parts.normSection.toFixed(4)),
              distance_km:
                t.parts.distanceKm != null
                  ? Number(t.parts.distanceKm.toFixed(2))
                  : null,
              proximity: Number(t.parts.proximity.toFixed(4)),
              blend: Number(t.parts.blend.toFixed(4)),
            })),
          }),
        );
      }
    } else if (useMeiliRelevanceOrder && meiliCandidateIds) {
      const orderMap = new Map(meiliCandidateIds.map((id, i) => [id, i]));
      const sorted = [...rows].sort(
        (a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999),
      );
      data = attachDistance(sorted.slice(skip, skip + take));
    } else {
      data = attachDistance(rows);
    }

    return this.wrapSearchResult(page, pageSize, totalOut, data);
  }

  async findOne(id: number) {
    if (this.cache.isConfigured()) {
      const cached = await this.cache.get(CACHE_KEY_RESTAURANT(id));
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore parse error
        }
      }
    }
    const restaurant = await this.prisma.restaurants.findUnique({
      where: { id },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }
    if (this.cache.isConfigured()) {
      try {
        await this.cache.set(
          CACHE_KEY_RESTAURANT(id),
          JSON.stringify(restaurant),
          CACHE_TTL_ENTITY,
        );
      } catch {
        // ignore
      }
    }
    return restaurant;
  }

  async create(dto: CreateRestaurantDto) {
    const data: Prisma.restaurantsCreateInput = {
      name_default: dto.name_default,
      city: dto.city ?? undefined,
      district: dto.district ?? undefined,
      address_line1: dto.address_line1 ?? undefined,
      cuisine_tags: dto.cuisine_tags,
      price_level: dto.price_level ?? undefined,
      veg_friendly: dto.veg_friendly ?? undefined,
      halal_certified: dto.halal_certified ?? undefined,
    };
    const restaurant = await this.prisma.restaurants.create({ data });
    if (
      dto.lat != null &&
      dto.lng != null &&
      !Number.isNaN(dto.lat) &&
      !Number.isNaN(dto.lng)
    ) {
      await this.setGeomFromLatLng(restaurant.id, dto.lat, dto.lng);
    }
    await this.searchService.indexRestaurant(restaurant.id);
    await this.invalidateRestaurantCache(restaurant.id);
    return this.findOne(restaurant.id);
  }

  async update(id: number, dto: UpdateRestaurantDto) {
    try {
      const data: Prisma.restaurantsUpdateInput = {};
      if (dto.name_default !== undefined) data.name_default = dto.name_default;
      if (dto.city !== undefined) data.city = dto.city;
      if (dto.district !== undefined) data.district = dto.district;
      if (dto.address_line1 !== undefined) data.address_line1 = dto.address_line1;
      if (dto.cuisine_tags !== undefined) data.cuisine_tags = dto.cuisine_tags;
      if (dto.price_level !== undefined) data.price_level = dto.price_level;
      if (dto.veg_friendly !== undefined) data.veg_friendly = dto.veg_friendly;
      if (dto.halal_certified !== undefined) data.halal_certified = dto.halal_certified;

      await this.prisma.restaurants.update({
        where: { id },
        data,
      });
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException('Restaurant not found');
      }
      throw err;
    }
    if (
      dto.lat != null &&
      dto.lng != null &&
      !Number.isNaN(dto.lat) &&
      !Number.isNaN(dto.lng)
    ) {
      await this.setGeomFromLatLng(id, dto.lat, dto.lng);
    }
    await this.searchService.indexRestaurant(id);
    await this.invalidateRestaurantCache(id);
    return this.findOne(id);
  }

  /** Invalidate cache for one restaurant and list caches. */
  private async invalidateRestaurantCache(restaurantId: number): Promise<void> {
    await this.cache.del(CACHE_KEY_RESTAURANT(restaurantId));
    await this.cache.delByPattern(CACHE_PATTERN_RESTAURANTS_LIST);
  }

  /** Set restaurants.geom from lat/lng (PostGIS). Prisma cannot write geography. */
  private async setGeomFromLatLng(
    restaurantId: number,
    lat: number,
    lng: number,
  ): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE restaurants
        SET geom = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        WHERE id = ${restaurantId}
      `,
    );
  }

  /**
   * Normalize Google `user_ratings_total`; invalid values → undefined (skip DB write for count).
   */
  private normalizeGoogleRatingCount(
    value: number | undefined | null,
  ): number | undefined {
    if (value === undefined || value === null) return undefined;
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 0) return undefined;
    return n;
  }

  /**
   * Upsert a restaurant from Google Places import data.
   * Keeps geom, search index, and cache in sync. Idempotent by google_place_id.
   *
   * `ratingCount`: from `user_ratings_total`. When omitted on update, `rating_count` is left unchanged.
   * Never overwrites a non-zero `rating_count` with 0 (stale/zero from API).
   */
  async upsertFromGooglePlace(data: {
    googlePlaceId: string;
    name: string;
    addressLine1?: string;
    city?: string;
    district?: string;
    latitude: number;
    longitude: number;
    rating?: number;
    /** Google Places `user_ratings_total` → `rating_count`. */
    ratingCount?: number;
    photoReference?: string;
    category?: string;
  }): Promise<{ id: number; created: boolean }> {
    const name = data.name?.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    if (!data.googlePlaceId?.trim()) {
      throw new BadRequestException('googlePlaceId is required');
    }
    const lat = Number(data.latitude);
    const lng = Number(data.longitude);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      throw new BadRequestException('latitude must be between -90 and 90');
    }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      throw new BadRequestException('longitude must be between -180 and 180');
    }

    const normalizedRatingCount = this.normalizeGoogleRatingCount(data.ratingCount);

    const existing = await this.prisma.restaurants.findUnique({
      where: { google_place_id: data.googlePlaceId.trim() },
      select: { id: true, rating_count: true },
    });

    const createData: Prisma.restaurantsCreateInput = {
      google_place_id: data.googlePlaceId.trim(),
      name_default: name.slice(0, 200),
      address_line1: data.addressLine1?.trim()?.slice(0, 500),
      city: data.city?.trim()?.slice(0, 100),
      district: data.district?.trim()?.slice(0, 100),
      cuisine_tags: [],
      latitude: lat,
      longitude: lng,
      rating: data.rating,
      rating_count: normalizedRatingCount ?? 0,
      photo_reference: data.photoReference?.trim()?.slice(0, 500),
      category: data.category?.trim()?.slice(0, 100),
    };
    const updateData: Prisma.restaurantsUpdateInput = {
      name_default: name.slice(0, 200),
      address_line1: data.addressLine1?.trim()?.slice(0, 500),
      city: data.city?.trim()?.slice(0, 100),
      district: data.district?.trim()?.slice(0, 100),
      latitude: lat,
      longitude: lng,
      rating: data.rating,
      photo_reference: data.photoReference?.trim()?.slice(0, 500),
      category: data.category?.trim()?.slice(0, 100),
    };

    if (normalizedRatingCount !== undefined) {
      const existingRc = existing?.rating_count ?? 0;
      if (!(normalizedRatingCount === 0 && existingRc > 0)) {
        updateData.rating_count = normalizedRatingCount;
      }
    }
    const restaurant = await this.prisma.restaurants.upsert({
      where: { google_place_id: data.googlePlaceId.trim() },
      create: createData,
      update: updateData,
    });

    await this.setGeomFromLatLng(restaurant.id, lat, lng);
    await this.searchService.indexRestaurant(restaurant.id);
    await this.invalidateRestaurantCache(restaurant.id);

    return { id: restaurant.id, created: !existing };
  }

  /**
   * Combined GET /search: reuse full restaurant search (Meilisearch or Prisma) with a small limit.
   * After the same filters as list search, results are ordered by `popular_score` (see RankingService).
   */
  async quickSearchCombined(
    q: string,
    limit: number,
  ): Promise<RestaurantsSearchResult['data']> {
    const clamped = Math.min(Math.max(limit, 1), 50);
    const dto: SearchRestaurantsDto = {
      q: q.trim(),
      page: '1',
      limit: String(clamped),
      sort: 'popular',
    };
    const res = await this.search(dto);
    return res.data;
  }

  async delete(id: number) {
    try {
      await this.prisma.restaurants.delete({
        where: { id },
      });
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException('Restaurant not found');
      }
      throw err;
    }
    await this.searchService.deleteRestaurantFromIndex(id);
    await this.invalidateRestaurantCache(id);
  }

}
