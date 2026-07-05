import { Controller, Get, Header, VERSION_NEUTRAL } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/auth/public.decorator.js';
import type { AppConfig } from '../../config/configuration.js';
import { renderPrivacyPolicyHtml } from './privacy-policy.template.js';

/**
 * Public legal pages (privacy policy, etc.) served at the API root for Google Play
 * and other store listings. Excluded from the global `/api` prefix in `main.ts`.
 */
@Controller({ version: VERSION_NEUTRAL })
export class LegalController {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  @Public()
  @Get('privacy-policy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  privacyPolicy(): string {
    const contactEmail = this.config.get('ownerEmail', { infer: true }) || 'mhd7190@gmail.com';
    return renderPrivacyPolicyHtml(contactEmail);
  }
}
