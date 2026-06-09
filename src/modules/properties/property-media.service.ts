import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ObjectStoreService } from '../../infra/objectstore/object-store.service.js';
import type { PropertyImageRecord, PropertyVideoRecord } from './property.enums.js';

/**
 * Shared media validation for property images/videos. Used by both the
 * owner-facing command service and the admin update path so the "validate the
 * real bytes, then replace the set" logic lives in exactly one place.
 */
@Injectable()
export class PropertyMediaService {
  private readonly videoMaxBytes: number;

  constructor(
    private readonly objectStore: ObjectStoreService,
    config: ConfigService
  ) {
    this.videoMaxBytes = config.getOrThrow<number>('videoMaxBytes');
  }

  async headImages(objectKeys: string[]): Promise<PropertyImageRecord[]> {
    const now = new Date();
    const images: PropertyImageRecord[] = [];
    for (let index = 0; index < objectKeys.length; index += 1) {
      const objectKey = objectKeys[index]!;
      const head = await this.objectStore.head(objectKey);
      if (!head) {
        throw new UnprocessableEntityException({
          code: 'uploadMissing',
          message: `Object not found in storage: ${objectKey}`
        });
      }
      // The stored Content-Type is client-supplied and can lie (a serialized RN
      // Blob was once uploaded as image/png). Validate the real bytes.
      if (!(await this.objectStore.isValidImage(objectKey))) {
        throw new UnprocessableEntityException({
          code: 'uploadInvalidImage',
          message: `Uploaded object is not a valid image: ${objectKey}`
        });
      }
      images.push({
        objectKey,
        contentType: head.contentType,
        sizeBytes: head.sizeBytes,
        sortOrder: index,
        uploadedAt: now
      });
    }
    return images;
  }

  async headVideos(objectKeys: string[]): Promise<PropertyVideoRecord[]> {
    const now = new Date();
    const videos: PropertyVideoRecord[] = [];
    for (let index = 0; index < objectKeys.length; index += 1) {
      const objectKey = objectKeys[index]!;
      const head = await this.objectStore.head(objectKey);
      if (!head) {
        throw new UnprocessableEntityException({
          code: 'uploadMissing',
          message: `Object not found in storage: ${objectKey}`
        });
      }
      if (head.sizeBytes > this.videoMaxBytes) {
        throw new UnprocessableEntityException({
          code: 'videoTooLarge',
          message: `Uploaded video exceeds ${this.videoMaxBytes} bytes: ${objectKey}`
        });
      }
      // Content-Type is client-supplied and untrustworthy — validate the real
      // bytes (the `ftyp` box) the same way images are checked.
      if (!(await this.objectStore.isValidVideo(objectKey))) {
        throw new UnprocessableEntityException({
          code: 'uploadInvalidVideo',
          message: `Uploaded object is not a valid video: ${objectKey}`
        });
      }
      videos.push({
        objectKey,
        contentType: head.contentType,
        sizeBytes: head.sizeBytes,
        sortOrder: index,
        uploadedAt: now
      });
    }
    return videos;
  }
}
