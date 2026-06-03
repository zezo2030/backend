import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ObjectStoreService } from './object-store.service.js';

@Injectable()
export class ObjectStoreUrlService {
  private readonly publicBaseUrl: string;

  constructor(
    config: ConfigService,
    private readonly objectStore: ObjectStoreService
  ) {
    const supabaseUrl = config.getOrThrow<string>('supabase.url').replace(/\/+$/, '');
    const bucket = config.getOrThrow<string>('supabase.storageBucket');
    this.publicBaseUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}`;
  }

  publicUrl(objectKey: string): string {
    const encodedPath = objectKey.split('/').map((segment) => encodeURIComponent(segment)).join('/');
    return `${this.publicBaseUrl}/${encodedPath}`;
  }

  /** Signed read URL so images work when the bucket is not public. */
  async mediaReadUrl(objectKey: string): Promise<string> {
    try {
      return await this.objectStore.createSignedReadUrl(objectKey, 86_400);
    } catch {
      return this.publicUrl(objectKey);
    }
  }
}
