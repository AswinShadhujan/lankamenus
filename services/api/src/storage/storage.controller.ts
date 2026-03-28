import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { StorageService, MAX_IMAGE_SIZE_BYTES } from './storage.service';

@Controller('upload')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /**
   * Upload an image for use as a dish image (or other menu item).
   * Admin only. Returns { url } to store in image_url.
   */
  @Post('image')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded. Send as multipart form field "file".');
    }
    const buffer = 'buffer' in file && Buffer.isBuffer((file as Express.Multer.File & { buffer?: Buffer }).buffer)
      ? (file as Express.Multer.File & { buffer: Buffer }).buffer
      : null;
    if (!buffer) {
      throw new BadRequestException('File upload failed. Ensure the server uses memory storage for uploads.');
    }

    try {
      this.storage.validateImage(file.mimetype, file.size);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid file';
      throw new BadRequestException(message);
    }

    if (!this.storage.isConfigured()) {
      throw new BadRequestException(
        'Image upload is not configured. Set STORAGE_* environment variables.',
      );
    }

    const { url } = await this.storage.uploadImage(buffer, file.mimetype);
    return { url };
  }
}
