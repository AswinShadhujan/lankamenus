import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { FavouritesService } from './favourites.service';
import { DishFavouritesService } from './dish-favourites.service';
import { CreateFavouriteDto } from './dto/create-favourite.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class FavouritesController {
  constructor(
    private favouritesService: FavouritesService,
    private dishFavouritesService: DishFavouritesService,
  ) {}

  @Get('favourites')
  async list(@Req() req: { user?: { userId?: number } }) {
    const userId = req.user?.userId;
    if (userId == null) throw new UnauthorizedException();
    const restaurants = await this.favouritesService.findAllByUserId(userId);
    return { data: restaurants };
  }

  @Post('favourites')
  @HttpCode(HttpStatus.CREATED)
  async add(
    @Req() req: { user?: { userId?: number } },
    @Body() dto: CreateFavouriteDto,
  ) {
    const userId = req.user?.userId;
    if (userId == null) throw new UnauthorizedException();
    await this.favouritesService.add(userId, dto.restaurantId);
  }

  @Delete('favourites/:restaurantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: { user?: { userId?: number } },
    @Param('restaurantId', ParseIntPipe) restaurantId: number,
  ) {
    const userId = req.user?.userId;
    if (userId == null) throw new UnauthorizedException();
    await this.favouritesService.remove(userId, restaurantId);
  }

  // ——— Dish favourites (nested under favourites/* so routing layers under users/me/register correctly) ———

  @Get('favourites/dishes/ids')
  async listDishIds(@Req() req: { user?: { userId?: number } }) {
    const userId = req.user?.userId;
    if (userId == null) throw new UnauthorizedException();
    const ids = await this.dishFavouritesService.findDishIdsByUserId(userId);
    return { ids };
  }

  @Get('favourites/dishes')
  async listDishes(@Req() req: { user?: { userId?: number } }) {
    const userId = req.user?.userId;
    if (userId == null) throw new UnauthorizedException();
    const dishes = await this.dishFavouritesService.findAllByUserId(userId);
    return { data: dishes };
  }

  @Post('favourites/dishes/:id')
  @HttpCode(HttpStatus.OK)
  async addDish(
    @Req() req: { user?: { userId?: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = req.user?.userId;
    if (userId == null) throw new UnauthorizedException();
    await this.dishFavouritesService.add(userId, id);
    return { success: true, dish_id: id };
  }

  @Delete('favourites/dishes/:id')
  @HttpCode(HttpStatus.OK)
  async removeDish(
    @Req() req: { user?: { userId?: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = req.user?.userId;
    if (userId == null) throw new UnauthorizedException();
    await this.dishFavouritesService.remove(userId, id);
    return { success: true };
  }
}
