import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  ParseIntPipe,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { MenuItemPortionsService } from './menu-item-portions.service';
import { CreateMenuItemPortionDto } from './dto/create-menu-item-portion.dto';
import { UpdateMenuItemPortionDto } from './dto/update-menu-item-portion.dto';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { RolesGuard } from '../auth/roles.guard';

@Controller('menu-items')
export class MenuItemPortionsController {
  constructor(private readonly portionsService: MenuItemPortionsService) {}

  @Get(':itemId/portions')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  listPortions(@Param('itemId', ParseIntPipe) itemId: number) {
    return this.portionsService.listPortions(itemId);
  }

  @Post(':itemId/portions')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  createPortion(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: CreateMenuItemPortionDto,
  ) {
    return this.portionsService.createPortion(itemId, dto);
  }

  @Patch(':itemId/portions/:portionId')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  updatePortion(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Param('portionId', ParseIntPipe) portionId: number,
    @Body() dto: UpdateMenuItemPortionDto,
  ) {
    return this.portionsService.updatePortion(itemId, portionId, dto);
  }

  @Delete(':itemId/portions/:portionId')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  deletePortion(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Param('portionId', ParseIntPipe) portionId: number,
  ) {
    return this.portionsService.deletePortion(itemId, portionId);
  }
}
