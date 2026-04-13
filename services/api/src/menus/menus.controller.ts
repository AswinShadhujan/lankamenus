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
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { MenusService } from './menus.service';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { SetMenuItemImageUrlDto } from './dto/set-menu-item-image-url.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

const MAX_DISH_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_DISH_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Controller('menus')
export class MenusController {
  constructor(
    private readonly menusService: MenusService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ——— Sections (more specific paths first) ———
  @Post(':menuId/sections')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  createSection(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Body() dto: CreateSectionDto,
  ) {
    return this.menusService.createSection(menuId, dto);
  }

  @Patch(':menuId/sections/:sectionId')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  updateSection(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.menusService.updateSection(menuId, sectionId, dto);
  }

  @Delete(':menuId/sections/:sectionId')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSection(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
  ): Promise<void> {
    await this.menusService.deleteSection(menuId, sectionId);
  }

  // ——— Items (GET one item must be before @Get(':id') so Nest matches it first) ———
  @Public()
  @Get(':menuId/items/:itemId')
  getOneItem(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: Request,
  ) {
    return this.menusService.findOneItem(menuId, itemId, req);
  }

  @Post(':menuId/items')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  createItem(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.menusService.createItem(menuId, dto);
  }

  @Post(':menuId/items/:itemId/image')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DISH_IMAGE_BYTES },
    }),
  )
  uploadItemImage(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    this.cloudinary.assertUploadAllowed();
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_DISH_MIME.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${ALLOWED_DISH_MIME.join(', ')}`,
      );
    }
    return this.menusService.replaceItemCoverFromUpload(
      menuId,
      itemId,
      file.buffer,
      file.mimetype,
      req,
    );
  }

  @Patch(':menuId/items/:itemId/image-url')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  setItemImageUrl(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: SetMenuItemImageUrlDto,
    @Req() req: Request,
  ) {
    return this.menusService.replaceItemCoverFromExternalUrl(
      menuId,
      itemId,
      dto.imageUrl,
      req,
    );
  }

  @Patch(':menuId/items/:itemId')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  updateItem(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menusService.updateItem(menuId, itemId, dto);
  }

  @Delete(':menuId/items/:itemId')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteItem(
    @Param('menuId', ParseIntPipe) menuId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ): Promise<void> {
    await this.menusService.deleteItem(menuId, itemId);
  }

  // ——— Menu (single resource) ———
  @Public()
  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.menusService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  updateMenu(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuDto) {
    return this.menusService.updateMenu(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMenu(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.menusService.deleteMenu(id);
  }
}
