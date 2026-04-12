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
} from '@nestjs/common';
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

import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { RolesGuard } from '../auth/roles.guard';

@Controller('restaurants')
export class RestaurantsController {
  private readonly logger = new Logger(RestaurantsController.name);

  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly googlePlacesService: GooglePlacesService,
    private readonly menusService: MenusService,
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
    const ref = (restaurant as { photo_reference?: string | null }).photo_reference;
    if (!ref?.trim() || !this.googlePlacesService.isConfigured()) {
      throw new NotFoundException('Photo not available');
    }
    const photoUrl = this.googlePlacesService.getPhotoUrl(ref, 800);
    res.redirect(302, photoUrl);
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
