import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator.js';
import { LocationsService, type LocationDto } from './locations.service.js';

@Public()
@Controller({ path: 'locations', version: '1' })
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('cities')
  listCities(): Promise<LocationDto[]> {
    return this.locations.listCities();
  }

  @Get('cities/:cityId/areas')
  listAreas(@Param('cityId') cityId: string): Promise<LocationDto[]> {
    return this.locations.listAreas(cityId);
  }
}
