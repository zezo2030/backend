import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator.js';
import { BannersService } from './banners.service.js';

@Controller({ path: 'banners', version: '1' })
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  @Public()
  @Get()
  list() {
    return this.banners.listPublic();
  }
}
