import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BannersService } from './banners.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { ReorderBannersDto } from './dto/reorder-banners.dto';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { RolesGuard } from '../auth/roles.guard';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Controller('banners')
export class BannersController {
  constructor(
    private readonly bannersService: BannersService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /** Public: active banners for the homepage hero. */
  @Public()
  @Get('active')
  getActive() {
    return this.bannersService.findActive();
  }

  /** Public: active banners specifically linked to this restaurant. */
  @Public()
  @Get('restaurant/:restaurantId/active')
  getActiveForRestaurant(
    @Param('restaurantId', ParseIntPipe) restaurantId: number,
  ) {
    return this.bannersService.findActiveForRestaurant(restaurantId);
  }

  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Get()
  findAll() {
    return this.bannersService.findAll();
  }

  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bannersService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBannerDto) {
    return this.bannersService.create(dto);
  }

  /** Static path — must be registered before :id to avoid NestJS param capture. */
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Patch('reorder')
  reorder(@Body() dto: ReorderBannersDto) {
    return this.bannersService.reorder(dto.ids);
  }

  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBannerDto,
  ) {
    return this.bannersService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.bannersService.delete(id);
  }

  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.cloudinary.assertUploadAllowed();
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${ALLOWED_MIME.join(', ')}`,
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File too large (max 5 MB)');
    }
    return this.bannersService.uploadImage(id, file.buffer, file.originalname);
  }

  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.bannersService.toggleActive(id, true);
  }

  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.bannersService.toggleActive(id, false);
  }
}
