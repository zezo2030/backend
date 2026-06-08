import type { ConfigService } from '@nestjs/config';
import { WellKnownController } from '../../src/modules/well-known/well-known.controller.js';

type Android = { packageName: string; certFingerprints: string[] };

const makeController = (android: Android): WellKnownController => {
  const config = {
    get: (key: string) => (key === 'android' ? android : undefined)
  } as unknown as ConfigService;
  return new WellKnownController(config as never);
};

describe('WellKnownController.assetLinks', () => {
  it('emits a valid Digital Asset Links statement when a fingerprint is configured', () => {
    const sha = 'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C';
    const result = makeController({
      packageName: 'com.realestatemobile',
      certFingerprints: [sha]
    }).assetLinks();

    expect(result).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.realestatemobile',
          sha256_cert_fingerprints: [sha]
        }
      }
    ]);
  });

  it('supports multiple fingerprints (upload key + Play App Signing key)', () => {
    const result = makeController({
      packageName: 'com.realestatemobile',
      certFingerprints: ['AA:BB', 'CC:DD']
    }).assetLinks();

    expect(result[0]?.target.sha256_cert_fingerprints).toEqual(['AA:BB', 'CC:DD']);
  });

  it('returns an empty list (verification pending) when no fingerprint is set', () => {
    const result = makeController({
      packageName: 'com.realestatemobile',
      certFingerprints: []
    }).assetLinks();

    expect(result).toEqual([]);
  });
});
