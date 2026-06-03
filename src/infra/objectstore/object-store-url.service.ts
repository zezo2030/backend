import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ObjectStoreUrlService {
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    const supabaseUrl = config.getOrThrow<string>('supabase.url').replace(/\/+$/, '');
    const bucket = config.getOrThrow<string>('supabase.storageBucket');
    this.publicBaseUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}`;
  }

  publicUrl(objectKey: string): string {
    const encodedPath = objectKey.split('/').map((segment) => encodeURIComponent(segment)).join('/');
    return `${this.publicBaseUrl}/${encodedPath}`;
  }
}
