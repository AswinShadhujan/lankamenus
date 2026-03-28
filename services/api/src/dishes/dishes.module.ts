import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DishesController } from './dishes.controller';
import { DishesService } from './dishes.service';

@Module({
  imports: [PrismaModule],
  controllers: [DishesController],
  providers: [DishesService],
})
export class DishesModule {}
