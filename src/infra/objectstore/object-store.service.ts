import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class ObjectStoreService {
  private readonly client: SupabaseClient;
  private readonly bucket: string;
  private readonly serviceRoleKey: string;
  private readonly supabaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.supabaseUrl = config.getOrThrow<string>('supabase.url').replace(/\/+$/, '');
    this.serviceRoleKey = config.getOrThrow<string>('supabase.serviceRoleKey');
    this.bucket = config.getOrThrow<string>('supabase.storageBucket');
    this.client = createClient(this.supabaseUrl, this.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  async presignPut(objectKey: string, _contentType: string, _ttlSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(objectKey, { upsert: false });
    if (error) throw error;
    return data.signedUrl;
  }

  async exists(objectKey: string): Promise<boolean> {
    return (await this.head(objectKey)) !== null;
  }

  async head(objectKey: string): Promise<{ contentType: string; sizeBytes: number } | null> {
    const encodedPath = objectKey.split('/').map((segment) => encodeURIComponent(segment)).join('/');
    const response = await fetch(`${this.supabaseUrl}/storage/v1/object/${this.bucket}/${encodedPath}`, {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey
      }
    });
    if (!response.ok) return null;
    return {
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      sizeBytes: Number(response.headers.get('content-length') ?? 0)
    };
  }

  async deleteObjects(objectKeys: string[]): Promise<void> {
    if (objectKeys.length === 0) return;
    const { error } = await this.client.storage.from(this.bucket).remove(objectKeys);
    if (error) throw error;
  }

  async ping(): Promise<boolean> {
    const { error } = await this.client.storage.from(this.bucket).list('', { limit: 1 });
    return !error;
  }
}
