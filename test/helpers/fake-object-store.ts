export interface FakeObjectMetadata {
  contentType: string;
  sizeBytes: number;
  lastModified: Date;
}

export class FakeObjectStore {
  private readonly objects = new Map<string, FakeObjectMetadata>();
  private readonly bodies = new Map<string, Buffer>();
  public readonly presignedRequests: Array<{
    objectKey: string;
    contentType: string;
    ttlSeconds: number;
  }> = [];

  reset(): void {
    this.objects.clear();
    this.bodies.clear();
    this.presignedRequests.length = 0;
  }

  putTestObject(objectKey: string, metadata: Partial<FakeObjectMetadata> = {}): void {
    const body =
      metadata.sizeBytes !== undefined
        ? Buffer.alloc(metadata.sizeBytes, 0xab)
        : Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
    this.seedObject(objectKey, body, metadata);
  }

  private seedObject(objectKey: string, body: Buffer, metadata: Partial<FakeObjectMetadata> = {}): void {
    this.bodies.set(objectKey, body);
    this.objects.set(objectKey, {
      contentType: metadata.contentType ?? 'image/jpeg',
      sizeBytes: metadata.sizeBytes ?? body.length,
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

  peekBytes(objectKey: string, length: number): Promise<Buffer | null> {
    const body = this.bodies.get(objectKey);
    if (!body) return Promise.resolve(null);
    return Promise.resolve(body.subarray(0, length));
  }

  getObject(objectKey: string): Promise<Buffer | null> {
    return Promise.resolve(this.bodies.get(objectKey) ?? null);
  }

  putObject(objectKey: string, body: Buffer, contentType: string): Promise<void> {
    this.seedObject(objectKey, body, { contentType, sizeBytes: body.length });
    return Promise.resolve();
  }

  isValidImage(objectKey: string): Promise<boolean> {
    return Promise.resolve(this.objects.has(objectKey));
  }

  isValidVideo(objectKey: string): Promise<boolean> {
    const meta = this.objects.get(objectKey);
    return Promise.resolve(Boolean(meta?.contentType.startsWith('video/')));
  }

  deleteObjects(objectKeys: string[]): Promise<void> {
    for (const key of objectKeys) this.objects.delete(key);
    return Promise.resolve();
  }

  ping(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
