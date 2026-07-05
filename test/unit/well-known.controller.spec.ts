import { existsSync } from 'node:fs';
import type { ConfigService } from '@nestjs/config';
import { WellKnownController } from '../../src/modules/well-known/well-known.controller.js';

type AndroidApp = {
  packageName: string;
  certFingerprints: string[];
  relations: string[];
};

type AndroidConfig = {
  assetLinksJson?: string;
  assetLinksPath?: string;
  apps: AndroidApp[];
};

const makeController = (android: AndroidConfig): WellKnownController => {
  const config = {
    get: (key: string) => (key === 'android' ? android : undefined)
  } as unknown as ConfigService;
  return new WellKnownController(config as never);
};

describe('WellKnownController.assetLinks', () => {
  const sha =
    'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C';

  it('emits a valid Digital Asset Links statement when apps are configured', () => {
    const result = makeController({
      assetLinksPath: '/nonexistent/assetlinks.json',
      apps: [
        {
          packageName: 'com.riden74.app',
          certFingerprints: [sha],
          relations: ['delegate_permission/common.handle_all_urls']
        }
      ]
    }).assetLinks();

    expect(result).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.riden74.app',
          sha256_cert_fingerprints: [sha]
        }
      }
    ]);
  });

  it('supports multiple apps with different relations', () => {
    const result = makeController({
      assetLinksPath: '/nonexistent/assetlinks.json',
      apps: [
        {
          packageName: 'com.realestatemobile',
          certFingerprints: [sha],
          relations: ['delegate_permission/common.handle_all_urls']
        },
        {
          packageName: 'com.riden74.app',
          certFingerprints: ['AA:BB'],
          relations: [
            'delegate_permission/common.handle_all_urls',
            'delegate_permission/common.get_login_creds'
          ]
        }
      ]
    }).assetLinks();

    expect(result).toHaveLength(2);
    expect(result[1]?.relation).toContain('delegate_permission/common.get_login_creds');
  });

  it('returns an empty list when no apps have fingerprints', () => {
    const result = makeController({
      assetLinksPath: '/nonexistent/assetlinks.json',
      apps: [{ packageName: 'com.riden74.app', certFingerprints: [], relations: [] }]
    }).assetLinks();

    expect(result).toEqual([]);
  });

  it('serves ANDROID_ASSET_LINKS_JSON when set', () => {
    const json = JSON.stringify([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.riden74.app',
          sha256_cert_fingerprints: ['AA:BB']
        }
      }
    ]);

    const result = makeController({
      assetLinksJson: json,
      assetLinksPath: '/nonexistent/assetlinks.json',
      apps: []
    }).assetLinks();

    expect(result[0]?.target.package_name).toBe('com.riden74.app');
  });

  it('reads from the default .well-known/assetlinks.json file when present', () => {
    const filePath = `${process.cwd()}/.well-known/assetlinks.json`;
    if (!existsSync(filePath)) {
      return;
    }

    const result = makeController({ apps: [] }).assetLinks();
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]?.target.namespace).toBe('android_app');
  });
});
