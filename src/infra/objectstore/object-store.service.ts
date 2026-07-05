import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupportedImage } from './image-magic.js';
import { isSupportedVideo } from './video-magic.js';

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

  async createSignedReadUrl(objectKey: string, expiresInSec: number): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(objectKey, expiresInSec);
    if (error) throw error;
    return data.signedUrl;
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
    const encodedPath = objectKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const response = await fetch(
      `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${encodedPath}`,
      {
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${this.serviceRoleKey}`,
          apikey: this.serviceRoleKey
        }
      }
    );
    if (!response.ok) return null;
    return {
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      sizeBytes: Number(response.headers.get('content-length') ?? 0)
    };
  }

  /** Read the first `length` bytes of an object via a ranged GET. */
  async peekBytes(objectKey: string, length: number): Promise<Buffer | null> {
    const encodedPath = objectKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const response = await fetch(
      `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${encodedPath}`,
      {
        headers: {
          Authorization: `Bearer ${this.serviceRoleKey}`,
          apikey: this.serviceRoleKey,
          Range: `bytes=0-${length - 1}`
        }
      }
    );
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Verify the stored object is a real image by its magic bytes, not its
   * (client-supplied, therefore untrustworthy) Content-Type. Guards against the
   * RN Blob-serialization upload bug.
   */
  async isValidImage(objectKey: string): Promise<boolean> {
    const buf = await this.peekBytes(objectKey, 16);
    return buf !== null && isSupportedImage(buf);
  }

  /**
   * Verify the stored object is a real video by its magic bytes (the `ftyp` box),
   * not its client-supplied Content-Type. Mirrors {@link isValidImage}.
   */
  async isValidVideo(objectKey: string): Promise<boolean> {
    const buf = await this.peekBytes(objectKey, 16);
    return buf !== null && isSupportedVideo(buf);
  }

  async getObject(objectKey: string): Promise<Buffer | null> {
    const encodedPath = objectKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const response = await fetch(
      `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${encodedPath}`,
      {
        headers: {
          Authorization: `Bearer ${this.serviceRoleKey}`,
          apikey: this.serviceRoleKey
        }
      }
    );
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  async putObject(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).upload(objectKey, body, {
      contentType,
      upsert: true
    });
    if (error) throw error;
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
