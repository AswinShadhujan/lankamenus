import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { SRI_LANKA_DISTRICTS } from './data/sri-lanka-districts';

@Controller('districts')
export class LocationsController {
  @Public()
  @Get()
  getDistricts() {
    return SRI_LANKA_DISTRICTS;
  }
}
