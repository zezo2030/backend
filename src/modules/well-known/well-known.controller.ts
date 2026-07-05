import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
 * Resolution order:
 * 1. `ANDROID_ASSET_LINKS_JSON` — paste the exact JSON from Google Play Console
 * 2. `ANDROID_ASSET_LINKS_PATH` (default: `.well-known/assetlinks.json` in cwd)
 * 3. `ANDROID_APPS` env (JSON array) or legacy `ANDROID_PACKAGE_NAME` + `ANDROID_CERT_SHA256`
 */
@Controller({ path: '.well-known', version: VERSION_NEUTRAL })
export class WellKnownController {
  private cachedStatements: AssetLinkStatement[] | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  @Public()
  @Get('assetlinks.json')
  @Header('Content-Type', 'application/json')
  @Header('Cache-Control', 'public, max-age=3600')
  assetLinks(): AssetLinkStatement[] {
    if (this.cachedStatements) {
      return this.cachedStatements;
    }

    const android = this.config.get('android', { infer: true });

    if (android.assetLinksJson) {
      this.cachedStatements = JSON.parse(android.assetLinksJson) as AssetLinkStatement[];
      return this.cachedStatements;
    }

    const filePath =
      android.assetLinksPath ?? join(process.cwd(), '.well-known', 'assetlinks.json');
    if (existsSync(filePath)) {
      this.cachedStatements = JSON.parse(readFileSync(filePath, 'utf8')) as AssetLinkStatement[];
      return this.cachedStatements;
    }

    const apps = android.apps ?? [];
    if (apps.length === 0) {
      this.cachedStatements = [];
      return this.cachedStatements;
    }

    this.cachedStatements = apps
      .filter((app) => app.certFingerprints.length > 0)
      .map((app) => ({
        relation: app.relations,
        target: {
          namespace: 'android_app' as const,
          package_name: app.packageName,
          sha256_cert_fingerprints: app.certFingerprints
        }
      }));

    return this.cachedStatements;
  }
}
