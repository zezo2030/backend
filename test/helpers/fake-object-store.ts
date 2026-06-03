export interface FakeObjectMetadata {
  contentType: string;
  sizeBytes: number;
  lastModified: Date;
}

export class FakeObjectStore {
  private readonly objects = new Map<string, FakeObjectMetadata>();
  public readonly presignedRequests: Array<{
    objectKey: string;
    contentType: string;
    ttlSeconds: number;
  }> = [];

  reset(): void {
    this.objects.clear();
    this.presignedRequests.length = 0;
  }

  putObject(objectKey: string, metadata: Partial<FakeObjectMetadata> = {}): void {
    this.objects.set(objectKey, {
      contentType: metadata.contentType ?? 'image/jpeg',
      sizeBytes: metadata.sizeBytes ?? 1024,
      lastModified: metadata.lastModified ?? new Date()
    });
  }

  presignPut(objectKey: string, contentType: string, ttlSeconds: number): Promise<string> {
    this.presignedRequests.push({ objectKey, contentType, ttlSeconds });
    return Promise.resolve(`https://fake-object-store.test/${objectKey}?expires=${ttlSeconds}`);
  }

  exists(objectKey: string): Promise<boolean> {
    return Promise.resolve(this.objects.has(objectKey));
  }

  head(objectKey: string): Promise<{ contentType: string; sizeBytes: number } | null> {
    const meta = this.objects.get(objectKey);
    if (!meta) return Promise.resolve(null);
    return Promise.resolve({ contentType: meta.contentType, sizeBytes: meta.sizeBytes });
  }

  peekBytes(objectKey: string, _length: number): Promise<Buffer | null> {
    if (!this.objects.has(objectKey)) return Promise.resolve(null);
    // Valid PNG magic header — stored test objects are treated as real images.
    return Promise.resolve(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0])
    );
  }

  isValidImage(objectKey: string): Promise<boolean> {
    return Promise.resolve(this.objects.has(objectKey));
  }

  deleteObjects(objectKeys: string[]): Promise<void> {
    for (const key of objectKeys) this.objects.delete(key);
    return Promise.resolve();
  }

  ping(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
