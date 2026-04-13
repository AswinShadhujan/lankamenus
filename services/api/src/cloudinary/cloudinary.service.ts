import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinarySdk, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

/** User-facing message when uploads are attempted without full Cloudinary env. */
export const CLOUDINARY_NOT_CONFIGURED_MESSAGE =
  'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server (sub-account / upload API credentials are supported).';

const LOG_NOT_CONFIGURED = 'Cloudinary is not configured. Image uploads are disabled.';

export type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
  width: number | null;
  height: number | null;
  format: string | null;
};

function readEnv(config: ConfigService, key: string): string | undefined {
  const fromProcess = process.env[key]?.trim();
  if (fromProcess) return fromProcess;
  const fromConfig = config.get<string>(key)?.trim();
  return fromConfig || undefined;
}

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private readonly logger = new Logger(CloudinaryService.name);
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.applyConfiguration();
  }

  /** Re-read env (ConfigService + process.env) and configure SDK. Safe to call multiple times. */
  private applyConfiguration(): void {
    const cloudName = readEnv(this.config, 'CLOUDINARY_CLOUD_NAME');
    const apiKey = readEnv(this.config, 'CLOUDINARY_API_KEY');
    const apiSecret = readEnv(this.config, 'CLOUDINARY_API_SECRET');

    const present = [cloudName, apiKey, apiSecret].filter(Boolean).length;
    if (present === 3) {
      cloudinarySdk.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.configured = true;
      this.logger.log(`Cloudinary configured (cloud_name=${cloudName})`);
      return;
    }

    this.configured = false;

    if (present > 0) {
      this.logger.warn(
        `${LOG_NOT_CONFIGURED} Incomplete Cloudinary env: provide all three variables or leave all unset (partial values are ignored).`,
      );
    } else {
      this.logger.warn(LOG_NOT_CONFIGURED);
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  assertUploadAllowed(): void {
    if (!this.configured) {
      throw new BadRequestException(CLOUDINARY_NOT_CONFIGURED_MESSAGE);
    }
  }

  async upload(
    buffer: Buffer,
    options?: { folder?: string; publicId?: string },
  ): Promise<CloudinaryUploadResult> {
    this.assertUploadAllowed();

    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Empty file buffer; nothing to upload.');
    }

    return new Promise((resolve, reject) => {
      const stream = cloudinarySdk.uploader.upload_stream(
        {
          folder: options?.folder ?? 'lankamenus',
          public_id: options?.publicId,
          resource_type: 'image',
          overwrite: true,
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            this.logger.error('Cloudinary upload failed', error);
            return reject(new BadRequestException('Image upload failed. Check Cloudinary credentials and file type.'));
          }
          if (!result.public_id || !result.secure_url) {
            this.logger.error('Cloudinary returned an unexpected response (missing public_id or secure_url)');
            return reject(new BadRequestException('Image upload failed: invalid response from storage.'));
          }
          resolve({
            public_id: result.public_id,
            secure_url: result.secure_url,
            width: typeof result.width === 'number' && Number.isFinite(result.width) ? result.width : null,
            height: typeof result.height === 'number' && Number.isFinite(result.height) ? result.height : null,
            format: typeof result.format === 'string' && result.format ? result.format : null,
          });
        },
      );

      const readable = Readable.from(buffer);
      readable.on('error', (err) => {
        this.logger.error('Read stream error before Cloudinary upload', err);
        reject(new BadRequestException('Could not read upload data.'));
      });
      readable.pipe(stream);
    });
  }

  async delete(publicId: string): Promise<void> {
    if (!this.configured || !publicId?.trim()) return;
    try {
      await cloudinarySdk.uploader.destroy(publicId.trim(), {
        resource_type: 'image',
      });
    } catch (err) {
      this.logger.error(`Cloudinary delete failed for ${publicId}`, err);
    }
  }
}
