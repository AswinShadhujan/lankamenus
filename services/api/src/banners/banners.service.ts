import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { BannerCtaType } from './dto/banner-cta-type';

@Injectable()
export class BannersService {
  constructor(
    private prisma: PrismaService,
    private media: MediaService,
  ) {}

  private bannerInclude = {
    media_asset: true,
    restaurant: { select: { id: true, name_default: true, slug: true } },
  } as const;

  private normalizeCtaType(v: string | null | undefined): BannerCtaType {
    const t = v?.trim();
    if (t === 'restaurant_detail' || t === 'cuisine' || t === 'custom_url') return t;
    return 'restaurants_list';
  }

  private isAllowedCustomUrl(url: string): boolean {
    const t = url.trim();
    if (!t) return false;
    if (t.startsWith('/')) return true;
    if (t.startsWith('#')) return true;
    return /^https?:\/\//i.test(t);
  }

  private async assertRestaurantExists(restaurantId: number): Promise<void> {
    const count = await this.prisma.restaurants.count({ where: { id: restaurantId } });
    if (count === 0) throw new BadRequestException('Selected restaurant does not exist');
  }

  private async buildCtaData(
    input: {
      cta_label?: string | null;
      cta_type?: string | null;
      cta_url?: string | null;
      restaurant_id?: number | null;
      cuisine_key?: string | null;
    },
    opts?: { requireOnCreate?: boolean },
  ): Promise<Record<string, unknown>> {
    const ctaLabel = input.cta_label?.trim() || null;
    const ctaType = this.normalizeCtaType(input.cta_type ?? null);
    const ctaUrl = input.cta_url?.trim() || null;
    const cuisineKey = input.cuisine_key?.trim() || null;
    const restaurantId = input.restaurant_id ?? null;

    if (opts?.requireOnCreate && ctaLabel && !ctaType) {
      throw new BadRequestException('CTA destination type is required when CTA label is set');
    }

    if (ctaType === 'restaurant_detail') {
      if (!restaurantId) {
        throw new BadRequestException('restaurant_detail CTA requires restaurant_id');
      }
      await this.assertRestaurantExists(restaurantId);
    }

    if (ctaType === 'cuisine' && !cuisineKey) {
      throw new BadRequestException('cuisine CTA requires cuisine_key');
    }

    if (ctaType === 'custom_url') {
      if (!ctaUrl) throw new BadRequestException('custom_url CTA requires cta_url');
      if (!this.isAllowedCustomUrl(ctaUrl)) {
        throw new BadRequestException('CTA URL must be an absolute URL, /path, or #anchor');
      }
    }

    return {
      cta_label: ctaLabel,
      cta_type: ctaType,
      cta_url: ctaType === 'custom_url' ? ctaUrl : null,
      restaurant_id: ctaType === 'restaurant_detail' ? restaurantId : null,
      cuisine_key: ctaType === 'cuisine' ? cuisineKey : null,
    };
  }

  async findAll() {
    return this.prisma.homepage_banners.findMany({
      orderBy: { sort_order: 'asc' },
      include: this.bannerInclude,
    });
  }

  /** Public: only active banners within their scheduled window. */
  async findActive() {
    const now = new Date();
    return this.prisma.homepage_banners.findMany({
      where: {
        is_active: true,
        OR: [
          { starts_at: null },
          { starts_at: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { ends_at: null },
              { ends_at: { gte: now } },
            ],
          },
        ],
      },
      orderBy: { sort_order: 'asc' },
      include: this.bannerInclude,
    });
  }

  /** Public: active banners linked to a specific restaurant. */
  async findActiveForRestaurant(restaurantId: number) {
    const now = new Date();
    return this.prisma.homepage_banners.findMany({
      where: {
        is_active: true,
        cta_type: 'restaurant_detail',
        restaurant_id: restaurantId,
        OR: [{ starts_at: null }, { starts_at: { lte: now } }],
        AND: [
          {
            OR: [{ ends_at: null }, { ends_at: { gte: now } }],
          },
        ],
      },
      orderBy: [{ sort_order: 'asc' }, { updated_at: 'desc' }],
      include: this.bannerInclude,
    });
  }

  async findOne(id: number) {
    const banner = await this.prisma.homepage_banners.findUnique({
      where: { id },
      include: this.bannerInclude,
    });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }

  async create(dto: CreateBannerDto) {
    const ctaData = await this.buildCtaData(dto, { requireOnCreate: true });
    return this.prisma.homepage_banners.create({
      data: {
        title: dto.title,
        subtitle: dto.subtitle,
        ...ctaData,
        overlay_color: dto.overlay_color,
        sort_order: dto.sort_order ?? 0,
        is_active: dto.is_active ?? true,
        starts_at: dto.starts_at ? new Date(dto.starts_at) : null,
        ends_at: dto.ends_at ? new Date(dto.ends_at) : null,
      },
      include: this.bannerInclude,
    });
  }

  async update(id: number, dto: UpdateBannerDto) {
    const existing = (await this.findOne(id)) as {
      cta_label?: string | null;
      cta_type?: string | null;
      cta_url?: string | null;
      restaurant_id?: number | null;
      cuisine_key?: string | null;
    };

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.subtitle !== undefined) data.subtitle = dto.subtitle;
    if (dto.overlay_color !== undefined) data.overlay_color = dto.overlay_color;
    if (dto.sort_order !== undefined) data.sort_order = dto.sort_order;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;
    if (dto.starts_at !== undefined) data.starts_at = dto.starts_at ? new Date(dto.starts_at) : null;
    if (dto.ends_at !== undefined) data.ends_at = dto.ends_at ? new Date(dto.ends_at) : null;

    if (
      dto.cta_label !== undefined ||
      dto.cta_type !== undefined ||
      dto.cta_url !== undefined ||
      dto.restaurant_id !== undefined ||
      dto.cuisine_key !== undefined
    ) {
      const ctaData = await this.buildCtaData({
        cta_label: dto.cta_label !== undefined ? dto.cta_label : existing.cta_label,
        cta_type: dto.cta_type !== undefined ? dto.cta_type : existing.cta_type,
        cta_url: dto.cta_url !== undefined ? dto.cta_url : existing.cta_url,
        restaurant_id:
          dto.restaurant_id !== undefined ? dto.restaurant_id : existing.restaurant_id,
        cuisine_key: dto.cuisine_key !== undefined ? dto.cuisine_key : existing.cuisine_key,
      });
      Object.assign(data, ctaData);
    }

    return this.prisma.homepage_banners.update({
      where: { id },
      data,
      include: this.bannerInclude,
    });
  }

  async delete(id: number) {
    const banner = await this.findOne(id);
    if (banner.media_asset_id) {
      try {
        await this.media.delete(banner.media_asset_id);
      } catch {
        // best-effort cleanup
      }
    }
    await this.prisma.homepage_banners.delete({ where: { id } });
  }

  async uploadImage(id: number, buffer: Buffer, altText?: string) {
    const banner = await this.findOne(id);

    // Delete old media asset if replacing
    if (banner.media_asset_id) {
      try {
        await this.media.delete(banner.media_asset_id);
      } catch {
        // best-effort cleanup
      }
    }

    const asset = await this.media.uploadAndCreate(buffer, {
      folder: 'lankamenus/banners',
      altText,
    });

    return this.prisma.homepage_banners.update({
      where: { id },
      data: { media_asset_id: asset.id },
      include: this.bannerInclude,
    });
  }

  async reorder(ids: number[]) {
    await this.prisma.$transaction(
      ids.map((bannerId, idx) =>
        this.prisma.homepage_banners.update({
          where: { id: bannerId },
          data: { sort_order: idx },
        }),
      ),
    );
    return this.findAll();
  }

  async toggleActive(id: number, isActive: boolean) {
    await this.ensureExists(id);
    return this.prisma.homepage_banners.update({
      where: { id },
      data: { is_active: isActive },
      include: this.bannerInclude,
    });
  }

  private async ensureExists(id: number) {
    const count = await this.prisma.homepage_banners.count({ where: { id } });
    if (count === 0) throw new NotFoundException('Banner not found');
  }
}
