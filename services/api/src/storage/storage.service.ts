import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

@Injectable()
export class StorageService {
  private readonly client: S3Client | null = null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly enabled: boolean;

  constructor(private config: ConfigService) {
    const bucket = this.config.get<string>('STORAGE_BUCKET');
    const publicBaseUrl = this.config.get<string>('STORAGE_PUBLIC_BASE_URL');
    const region = this.config.get<string>('STORAGE_REGION') ?? 'us-east-1';
    const endpoint = this.config.get<string>('STORAGE_ENDPOINT');
    const accessKeyId = this.config.get<string>('STORAGE_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('STORAGE_SECRET_ACCESS_KEY');

    this.enabled = !!(bucket && publicBaseUrl && accessKeyId && secretAccessKey);
    this.bucket = bucket ?? '';
    this.publicBaseUrl = publicBaseUrl?.replace(/\/$/, '') ?? '';

    if (this.enabled && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region,
        ...(endpoint && { endpoint }),
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        ...(endpoint && {
          forcePathStyle: true,
        }),
      });
    }
  }

  isConfigured(): boolean {
    return this.enabled && this.client != null;
  }

  /** Validate file is an allowed image type and within size limit. */
  validateImage(mimetype: string, size: number): void {
    if (!ALLOWED_MIMES.includes(mimetype as (typeof ALLOWED_MIMES)[number])) {
      throw new Error(
        `Invalid image type. Allowed: ${ALLOWED_MIMES.join(', ')}`,
      );
    }
    if (size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(
        `Image too large. Max size: ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`,
      );
    }
  }

  /**
   * Upload image buffer to object storage and return the public URL.
   * Key format: menu-items/{uuid}.{ext}
   */
  async uploadImage(
    buffer: Buffer,
    mimetype: string,
  ): Promise<{ url: string; key: string }> {
    if (!this.client || !this.bucket) {
      throw new Error(
        'Object storage is not configured. Set STORAGE_* environment variables.',
      );
    }

    const ext = EXT_BY_MIME[mimetype] ?? 'bin';
    const key = `menu-items/${randomUUID()}.${ext}`;

    const input: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    };

    await this.client.send(new PutObjectCommand(input));

    const url = `${this.publicBaseUrl}/${key}`;
    return { url, key };
  }
}
