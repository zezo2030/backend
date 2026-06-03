import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { ObjectStoreService } from '../../infra/objectstore/object-store.service.js';
import { PUSH_DISPATCHER, type PushDispatcher } from '../../infra/push/push.provider.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'ok' | 'error';
  objectStore: 'ok' | 'error';
  push: 'ok' | 'error';
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStore: ObjectStoreService,
    @Inject(PUSH_DISPATCHER) private readonly push: PushDispatcher
  ) {}

  async status(): Promise<HealthStatus> {
    let database: 'ok' | 'error' = 'error';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'ok';
    } catch {
      database = 'error';
    }

    let objectStore: 'ok' | 'error' = 'error';
    try {
      objectStore = (await this.objectStore.ping()) ? 'ok' : 'error';
    } catch {
      objectStore = 'error';
    }

    const pushStatus = this.push ? 'ok' : 'error';
    return {
      status: database === 'ok' && objectStore === 'ok' && pushStatus === 'ok' ? 'ok' : 'degraded',
      database,
      objectStore,
      push: pushStatus
    };
  }
}
