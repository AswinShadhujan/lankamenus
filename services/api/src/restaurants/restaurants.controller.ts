import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseIntPipe,
  Query,
  Body,
  Delete,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  UseGuards,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { RestaurantsService } from './restaurants.service';
import {
  SearchRestaurantsDto,
  firstQueryString,
} from './dto/search-restaurants.dto';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { SetExtraCostsDto } from './dto/set-extra-costs.dto';
import { GooglePlacesService } from '../integrations/google/google-places.service';
import { MenusService } from '../menus/menus.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { SetRestaurantImageUrlDto } from './dto/set-restaurant-image-url.dto';

import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { RolesGuard } from '../auth/roles.guard';

const MAX_COVER_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Controller('restaurants')
export class RestaurantsController {
  private readonly logger = new Logger(RestaurantsController.name);

  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly googlePlacesService: GooglePlacesService,
    private readonly menusService: MenusService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // 🔓 Public browsing (no auth required)
  @Public()
  @Get()
  search(@Query() query: SearchRestaurantsDto) {
    // TODO(geo): remove after verifying bias vs strict in production
    this.logger.log(
      JSON.stringify({
        tag: 'GET_restaurants_hit',
        hasLat: !!firstQueryString(query.lat),
        hasLng: !!firstQueryString(query.lng),
        hasRadius: !!firstQueryString(query.radius_km),
        sort: query.sort ?? null,
      }),
    );
    return this.restaurantsService.search(query);
  }

  /** Admin: primary menu with sections/items (active preferred, else latest; creates default if none). */
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Get(':id/menu')
  getRestaurantEditorMenu(@Param('id', ParseIntPipe) restaurantId: number) {
    return this.menusService.getEditorMenuForRestaurant(restaurantId);
  }

  @Public()
  @Get(':id/photo')
  async getPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    const restaurant = await this.restaurantsService.findOne(id);
    const cover = (restaurant as { media_asset?: { secure_url?: string | null } | null })
      .media_asset?.secure_url?.trim();
    if (cover) {
      res.redirect(302, cover);
      return;
    }
    const ref = (restaurant as { photo_reference?: string | null }).photo_reference;
    if (!ref?.trim() || !this.googlePlacesService.isConfigured()) {
      throw new NotFoundException('Photo not available');
    }
    const photoUrl = this.googlePlacesService.getPhotoUrl(ref, 800);
    res.redirect(302, photoUrl);
  }

  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_COVER_IMAGE_BYTES },
    }),
  )
  uploadCoverImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.cloudinary.assertUploadAllowed();
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_COVER_MIME.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${ALLOWED_COVER_MIME.join(', ')}`,
      );
    }
    if (file.size > MAX_COVER_IMAGE_BYTES) {
      throw new BadRequestException('File too large (max 5 MB)');
    }
    return this.restaurantsService.replaceRestaurantCoverFromUpload(
      id,
      file.buffer,
      file.mimetype,
    );
  }

  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Patch(':id/image-url')
  setCoverImageUrl(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRestaurantImageUrlDto,
  ) {
    return this.restaurantsService.replaceRestaurantCoverFromExternalUrl(id, dto.imageUrl);
  }

  @Public()
  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.restaurantsService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateRestaurantDto) {
    return this.restaurantsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.restaurantsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRestaurant(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.restaurantsService.delete(id);
  }

  @Public()
  @Get(':id/extra-costs')
  getExtraCosts(@Param('id', ParseIntPipe) id: number) {
    return this.restaurantsService.getExtraCosts(id);
  }

  /** Replace all extra costs for a restaurant (idempotent). */
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @Patch(':id/extra-costs')
  setExtraCosts(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetExtraCostsDto,
  ) {
    return this.restaurantsService.setExtraCosts(id, dto.costs);
  }
}
