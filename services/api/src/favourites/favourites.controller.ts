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
import { CreateFavouriteDto } from './dto/create-favourite.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class FavouritesController {
  constructor(private favouritesService: FavouritesService) {}

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
}
