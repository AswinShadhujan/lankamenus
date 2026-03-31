import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @SkipThrottle()
  @Get('health')
  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  @Public()
  @SkipThrottle()
  @Get('test-db')
  async getTestDb() {
    const restaurants = await this.prisma.restaurants.findMany({
      take: 20,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        name_default: true,
        address_line1: true,
        created_at: true,
      },
    });

    return { data: restaurants };
  }
}
