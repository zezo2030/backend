import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator.js';
import { HealthService, type HealthStatus } from './health.service.js';

@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  status(): Promise<HealthStatus> {
    return this.health.status();
  }
}
