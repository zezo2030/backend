import { randomBytes } from 'node:crypto';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ObjectStoreService } from '../../infra/objectstore/object-store.service.js';
import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  MediaUploadRequestDto,
  isVideoContentType
} from './dto/media-upload.dto.js';

function createObjectId(): string {
  return randomBytes(16).toString('base64url');
}

export interface PresignedUpload {
  objectKey: string;
  uploadUrl: string;
  expiresAt: Date;
}

const CONTENT_TYPE_EXTENSIONS: Record<(typeof ALLOWED_MEDIA_CONTENT_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov'
};

@Injectable()
export class MediaService {
  private readonly presignTtlSec: number;
  private readonly imageMaxBytes: number;
  private readonly videoMaxBytes: number;

  constructor(
    private readonly objectStore: ObjectStoreService,
    config: ConfigService
  ) {
    this.presignTtlSec = config.getOrThrow<number>('supabase.presignTtlSec');
    this.imageMaxBytes = config.getOrThrow<number>('imageMaxBytes');
    this.videoMaxBytes = config.getOrThrow<number>('videoMaxBytes');
  }

  async issueUploads(
    userId: string,
    dto: MediaUploadRequestDto
  ): Promise<{ uploads: PresignedUpload[] }> {
    const uploads: PresignedUpload[] = [];
    for (const item of dto.items) {
      const isVideo = isVideoContentType(item.contentType);
      const maxBytes = isVideo ? this.videoMaxBytes : this.imageMaxBytes;
      if (item.sizeBytes > maxBytes) {
        throw new UnprocessableEntityException({
          code: isVideo ? 'videoTooLarge' : 'imageTooLarge',
          message: `sizeBytes exceeds ${maxBytes}`
        });
      }
      const ext = CONTENT_TYPE_EXTENSIONS[item.contentType];
      const objectKey = `uploads/${userId}/${createObjectId()}.${ext}`;
      const uploadUrl = await this.objectStore.presignPut(
        objectKey,
        item.contentType,
        this.presignTtlSec
      );
      uploads.push({
        objectKey,
        uploadUrl,
        expiresAt: new Date(Date.now() + this.presignTtlSec * 1000)
      });
    }
    return { uploads };
  }
}
