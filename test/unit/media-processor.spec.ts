import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import configuration from '../../src/config/configuration.js';
import { MediaProcessorService } from '../../src/infra/objectstore/media-processor.service.js';
import { ObjectStoreService } from '../../src/infra/objectstore/object-store.service.js';
import sharp from 'sharp';

describe('MediaProcessorService', () => {
  const objectBodies = new Map<string, Buffer>();

  const objectStore = {
    getObject: jest.fn(async (key: string) => objectBodies.get(key) ?? null),
    putObject: jest.fn(async (key: string, body: Buffer, contentType: string) => {
      objectBodies.set(key, body);
      return undefined;
    }),
    deleteObjects: jest.fn(async () => undefined)
  };

  let processor: MediaProcessorService;

  beforeEach(async () => {
    objectBodies.clear();
    jest.clearAllMocks();
    process.env.MEDIA_COMPRESSION_ENABLED = 'true';

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] })],
      providers: [
        MediaProcessorService,
        { provide: ObjectStoreService, useValue: objectStore }
      ]
    }).compile();

    processor = moduleRef.get(MediaProcessorService);
  });

  it('compresses a large JPEG into WebP and replaces the storage key', async () => {
    const sourceKey = 'uploads/user-1/source.jpg';
    const input = await sharp({
      create: { width: 2400, height: 1600, channels: 3, background: '#336699' }
    })
      .jpeg({ quality: 95 })
      .toBuffer();
    objectBodies.set(sourceKey, input);

    const result = await processor.optimizeImage(sourceKey, {
      contentType: 'image/jpeg',
      sizeBytes: input.length
    });

    expect(result.objectKey).not.toBe(sourceKey);
    expect(result.contentType).toBe('image/webp');
    expect(result.sizeBytes).toBeLessThan(input.length);
    expect(objectStore.putObject).toHaveBeenCalled();
    expect(objectStore.deleteObjects).toHaveBeenCalledWith([sourceKey]);
  });

  it('skips optimization for already-small WebP images', async () => {
    const sourceKey = 'uploads/user-1/tiny.webp';
    const input = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#abcdef' }
    })
      .webp({ quality: 70 })
      .toBuffer();
    objectBodies.set(sourceKey, input);

    const result = await processor.optimizeImage(sourceKey, {
      contentType: 'image/webp',
      sizeBytes: input.length
    });

    expect(result.objectKey).toBe(sourceKey);
    expect(objectStore.putObject).not.toHaveBeenCalled();
  });
});
