import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { validateExternalImageUrl } from './media-url.util';

@Injectable()
export class MediaService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async uploadAndCreate(
    buffer: Buffer,
    opts?: { folder?: string; altText?: string; mimeType?: string },
  ) {
    const result = await this.cloudinary.upload(buffer, {
      folder: opts?.folder ?? 'lankamenus',
    });

    const mimeType =
      opts?.mimeType ??
      (result.format ? `image/${result.format === 'jpg' ? 'jpeg' : result.format}` : null);

    return this.prisma.media_assets.create({
      data: {
        source_type: 'cloudinary',
        provider: 'cloudinary',
        public_id: result.public_id,
        secure_url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        mime_type: mimeType,
        alt_text: opts?.altText ?? null,
      },
    });
  }

  /** External HTTPS image URL (restaurant/dish fallback — not used for homepage banners). */
  async createFromExternalUrl(url: string, altText?: string) {
    const secureUrl = validateExternalImageUrl(url);
    return this.prisma.media_assets.create({
      data: {
        source_type: 'external_url',
        provider: 'external_url',
        secure_url: secureUrl,
        width: null,
        height: null,
        format: null,
        mime_type: null,
        alt_text: altText?.trim() || null,
      },
    });
  }

  async findOne(id: number) {
    const asset = await this.prisma.media_assets.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Media asset not found');
    return asset;
  }

  async delete(id: number) {
    const asset = await this.prisma.media_assets.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Media asset not found');
    if (asset.source_type === 'cloudinary' && asset.public_id?.trim()) {
      await this.cloudinary.delete(asset.public_id.trim());
    }
    await this.prisma.media_assets.delete({ where: { id } });
  }
}
