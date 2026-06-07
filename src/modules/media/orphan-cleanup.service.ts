import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { ObjectStoreService } from '../../infra/objectstore/object-store.service.js';

export interface OrphanCandidate {
  objectKey: string;
  lastModified: Date;
}

export interface OrphanCandidateLister {
  list(prefix: string): Promise<OrphanCandidate[]>;
}

const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class OrphanCleanupService {
  private readonly logger = new Logger(OrphanCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStore: ObjectStoreService
  ) {}

  async cleanup(lister: OrphanCandidateLister): Promise<{ deleted: number }> {
    const candidates = await lister.list('uploads/');
    const cutoff = new Date(Date.now() - ORPHAN_TTL_MS);
    const stale = candidates.filter((candidate) => candidate.lastModified < cutoff);
    if (stale.length === 0) return { deleted: 0 };

    const staleKeys = stale.map((item) => item.objectKey);
    const [referencedImages, referencedVideos] = await Promise.all([
      this.prisma.propertyImage.findMany({
        where: { objectKey: { in: staleKeys } },
        select: { objectKey: true }
      }),
      this.prisma.propertyVideo.findMany({
        where: { objectKey: { in: staleKeys } },
        select: { objectKey: true }
      })
    ]);
    const referencedSet = new Set(
      [...referencedImages, ...referencedVideos].map((row) => row.objectKey)
    );
    const orphans = stale.filter((item) => !referencedSet.has(item.objectKey));
    if (orphans.length === 0) return { deleted: 0 };

    await this.objectStore.deleteObjects(orphans.map((item) => item.objectKey));
    this.logger.log(`Orphan cleanup deleted ${orphans.length} object(s)`);
    return { deleted: orphans.length };
  }
}
