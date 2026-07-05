import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import sharp from 'sharp';
import { ObjectStoreService } from './object-store.service.js';

const execFileAsync = promisify(execFile);

export interface ProcessedObject {
  objectKey: string;
  contentType: string;
  sizeBytes: number;
}

function createObjectId(): string {
  return randomBytes(16).toString('base64url');
}

function uploadPrefix(objectKey: string): string {
  const parts = objectKey.split('/');
  if (parts.length < 3 || parts[0] !== 'uploads') {
    return `uploads/optimized/${createObjectId()}`;
  }
  return `uploads/${parts[1]}`;
}

@Injectable()
export class MediaProcessorService {
  private readonly logger = new Logger(MediaProcessorService.name);
  private readonly enabled: boolean;
  private readonly imageMaxDimension: number;
  private readonly imageWebpQuality: number;
  private readonly imageSkipBelowBytes: number;
  private readonly videoMaxHeight: number;
  private readonly videoCrf: number;
  private readonly videoSkipBelowBytes: number;
  private readonly videoTranscodeTimeoutMs: number;

  constructor(
    private readonly objectStore: ObjectStoreService,
    config: ConfigService
  ) {
    this.enabled = config.get<boolean>('mediaCompression.enabled') ?? true;
    this.imageMaxDimension = config.getOrThrow<number>('mediaCompression.imageMaxDimension');
    this.imageWebpQuality = config.getOrThrow<number>('mediaCompression.imageWebpQuality');
    this.imageSkipBelowBytes = config.getOrThrow<number>('mediaCompression.imageSkipBelowBytes');
    this.videoMaxHeight = config.getOrThrow<number>('mediaCompression.videoMaxHeight');
    this.videoCrf = config.getOrThrow<number>('mediaCompression.videoCrf');
    this.videoSkipBelowBytes = config.getOrThrow<number>('mediaCompression.videoSkipBelowBytes');
    this.videoTranscodeTimeoutMs = config.getOrThrow<number>(
      'mediaCompression.videoTranscodeTimeoutMs'
    );
  }

  async optimizeImage(objectKey: string, head: { contentType: string; sizeBytes: number }): Promise<ProcessedObject> {
    if (!this.enabled) {
      return { objectKey, contentType: head.contentType, sizeBytes: head.sizeBytes };
    }

    const alreadyWebp =
      head.contentType === 'image/webp' && head.sizeBytes <= this.imageSkipBelowBytes;
    if (alreadyWebp) {
      return { objectKey, contentType: head.contentType, sizeBytes: head.sizeBytes };
    }

    try {
      const input = await this.objectStore.getObject(objectKey);
      if (!input) {
        return { objectKey, contentType: head.contentType, sizeBytes: head.sizeBytes };
      }

      const pipeline = sharp(input, { failOn: 'none' }).rotate();
      const metadata = await pipeline.metadata();
      const width = metadata.width ?? 0;
      const resizeNeeded = width > this.imageMaxDimension;
      const resized = resizeNeeded
        ? pipeline.resize({ width: this.imageMaxDimension, withoutEnlargement: true })
        : pipeline;

      const output = await resized
        .webp({ quality: this.imageWebpQuality, effort: 4 })
        .toBuffer();

      if (output.length >= input.length && head.contentType === 'image/webp' && !resizeNeeded) {
        return { objectKey, contentType: head.contentType, sizeBytes: head.sizeBytes };
      }

      const optimizedKey = `${uploadPrefix(objectKey)}/${createObjectId()}.webp`;
      await this.objectStore.putObject(optimizedKey, output, 'image/webp');

      if (optimizedKey !== objectKey) {
        await this.objectStore.deleteObjects([objectKey]);
      }

      this.logger.log(
        `Image optimized ${objectKey} -> ${optimizedKey} (${head.sizeBytes} -> ${output.length} bytes)`
      );
      return {
        objectKey: optimizedKey,
        contentType: 'image/webp',
        sizeBytes: output.length
      };
    } catch (error) {
      this.logger.warn(
        `Image optimization failed for ${objectKey}, keeping original: ${error instanceof Error ? error.message : String(error)}`
      );
      return { objectKey, contentType: head.contentType, sizeBytes: head.sizeBytes };
    }
  }

  async optimizeVideo(objectKey: string, head: { contentType: string; sizeBytes: number }): Promise<ProcessedObject> {
    if (!this.enabled) {
      return { objectKey, contentType: head.contentType, sizeBytes: head.sizeBytes };
    }

    if (head.sizeBytes <= this.videoSkipBelowBytes) {
      return { objectKey, contentType: head.contentType, sizeBytes: head.sizeBytes };
    }

    let workDir: string | null = null;
    try {
      const input = await this.objectStore.getObject(objectKey);
      if (!input) {
        return { objectKey, contentType: head.contentType, sizeBytes: head.sizeBytes };
      }

      workDir = await mkdtemp(join(tmpdir(), 're-video-'));
      const inputPath = join(workDir, 'input.bin');
      const outputPath = join(workDir, 'output.mp4');
      await writeFile(inputPath, input);

      const scaleFilter = `scale=-2:'min(${this.videoMaxHeight},ih)'`;
      await execFileAsync(
        ffmpegInstaller.path,
        [
          '-i',
          inputPath,
          '-vf',
          scaleFilter,
          '-c:v',
          'libx264',
          '-crf',
          String(this.videoCrf),
          '-preset',
          'fast',
          '-movflags',
          '+faststart',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-y',
          outputPath
        ],
        { timeout: this.videoTranscodeTimeoutMs }
      );

      const output = await readFile(outputPath);
      if (output.length >= input.length) {
        return { objectKey, contentType: head.contentType, sizeBytes: head.sizeBytes };
      }

      const optimizedKey = `${uploadPrefix(objectKey)}/${createObjectId()}.mp4`;
      await this.objectStore.putObject(optimizedKey, output, 'video/mp4');

      if (optimizedKey !== objectKey) {
        await this.objectStore.deleteObjects([objectKey]);
      }

      this.logger.log(
        `Video optimized ${objectKey} -> ${optimizedKey} (${head.sizeBytes} -> ${output.length} bytes)`
      );
      return {
        objectKey: optimizedKey,
        contentType: 'video/mp4',
        sizeBytes: output.length
      };
    } catch (error) {
      this.logger.warn(
        `Video optimization failed for ${objectKey}, keeping original: ${error instanceof Error ? error.message : String(error)}`
      );
      return { objectKey, contentType: head.contentType, sizeBytes: head.sizeBytes };
    } finally {
      if (workDir) {
        await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }
}
