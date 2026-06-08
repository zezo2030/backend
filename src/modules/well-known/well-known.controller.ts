import { Controller, Get, Header, VERSION_NEUTRAL } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration.js';
import { Public } from '../../common/auth/public.decorator.js';

interface AssetLinkStatement {
  relation: string[];
  target: {
    namespace: 'android_app';
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}

/**
 * Serves the Android App Links verification file at
 * `https://<host>/.well-known/assetlinks.json` so that `https://<host>/listing/:id`
 * (and `/request/:id`) links open the mobile app directly instead of the browser.
 *
 * The signing-cert fingerprint(s) come from `ANDROID_CERT_SHA256` (comma-separated
 * to allow both the upload key and Google Play App Signing key). The route is
 * version-neutral and excluded from the global `/api` prefix in `main.ts`.
 */
@Controller({ path: '.well-known', version: VERSION_NEUTRAL })
export class WellKnownController {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  @Public()
  @Get('assetlinks.json')
  @Header('Content-Type', 'application/json')
  @Header('Cache-Control', 'public, max-age=3600')
  assetLinks(): AssetLinkStatement[] {
    const android = this.config.get('android', { infer: true });
    const fingerprints = android?.certFingerprints ?? [];
    if (fingerprints.length === 0) {
      // No fingerprint configured yet — return a valid (empty) statement list so
      // the endpoint exists; App Links verification stays pending until set.
      return [];
    }
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: android.packageName,
          sha256_cert_fingerprints: fingerprints
        }
      }
    ];
  }
}
