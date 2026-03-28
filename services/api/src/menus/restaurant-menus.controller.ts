import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MenusService } from './menus.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';

@Controller('restaurants/:restaurantId/menus')
export class RestaurantMenusController {
  constructor(private readonly menusService: MenusService) {}

  @Public()
  @Get()
  listByRestaurant(
    @Param('restaurantId', ParseIntPipe) restaurantId: number,
    @Query('active_only') activeOnly?: string,
  ) {
    const active = activeOnly !== 'false';
    return this.menusService.findByRestaurant(restaurantId, active);
  }

  @Post()
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('restaurantId', ParseIntPipe) restaurantId: number,
    @Body() dto: CreateMenuDto,
  ) {
    return this.menusService.createMenu(restaurantId, dto);
  }
}
