import { DeviceType, FanoutOutboxStatus, Role } from '@prisma/client';
import { toDecimal } from '../../src/common/prisma/decimal.util.js';
import { PUSH_DISPATCHER, type PushDispatcher } from '../../src/infra/push/push.provider.js';
import { FanoutReaper } from '../../src/modules/fanout/fanout.reaper.js';
import { FanoutWorker } from '../../src/modules/fanout/fanout.worker.js';
import { closeAuthTestApp, createAuthTestApp, type AuthTestApp } from '../helpers/auth-test-app.js';
import { seedArea, seedCity, truncateAllTables } from '../helpers/test-db.js';

describe('FanoutWorker (integration)', () => {
  let testApp: AuthTestApp;
  let worker: FanoutWorker;
  let reaper: FanoutReaper;
  let dispatcher: PushDispatcher;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    worker = testApp.app.get(FanoutWorker);
    reaper = testApp.app.get(FanoutReaper);
    dispatcher = testApp.app.get(PUSH_DISPATCHER);
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  beforeEach(async () => {
    await truncateAllTables(testApp.prisma);
  });

  it('enumerates active brokers/agencies, is idempotent, reaps leases, and invalidates dead tokens', async () => {
    const requesterId = await seedUser(Role.RegularUser, 'u5551000001@test.local');
    const brokerId = await seedUser(Role.Broker, 'u5551000002@test.local');
    const agencyId = await seedUser(Role.Agency, 'u5551000003@test.local');
    await seedUser(Role.RegularUser, 'u5551000004@test.local');
    await seedUser(Role.Broker, 'u5551000005@test.local', false);
    await seedToken(brokerId, 'broker-token');
    await seedToken(agencyId, 'agency-token');

    const propertyRequestId = await seedRequest(requesterId);
    await testApp.prisma.fanoutOutbox.create({
      data: {
        requestId: propertyRequestId,
        status: FanoutOutboxStatus.pending,
        attempts: 0,
        processedCount: 0
      }
    });

    dispatcher.dispatchTargets = (targets) =>
      Promise.resolve(
        targets.map(({ token }) => ({
          token,
          success: token !== 'agency-token',
          permanentFailure: token === 'agency-token'
        }))
      );

    await expect(worker.drainOnce()).resolves.toBe(true);

    expect(await testApp.prisma.notification.count()).toBe(2);
    expect(
      await testApp.prisma.notification.count({
        where: {
          sourceRequestId: propertyRequestId,
          recipientUserId: { in: [brokerId, agencyId] }
        }
      })
    ).toBe(2);
    expect(
      await testApp.prisma.deviceToken.findFirst({ where: { token: 'agency-token' } })
    ).toMatchObject({ isActive: false });
    expect(
      await testApp.prisma.fanoutOutbox.findUnique({ where: { requestId: propertyRequestId } })
    ).toMatchObject({
      status: FanoutOutboxStatus.done,
      recipientCount: 2,
      processedCount: 2
    });

    await testApp.prisma.fanoutOutbox.update({
      where: { requestId: propertyRequestId },
      data: {
        status: FanoutOutboxStatus.pending,
        leasedBy: null,
        leasedUntil: null,
        processedCount: 0
      }
    });
    await expect(worker.drainOnce()).resolves.toBe(true);
    expect(await testApp.prisma.notification.count()).toBe(2);

    await testApp.prisma.fanoutOutbox.update({
      where: { requestId: propertyRequestId },
      data: {
        status: FanoutOutboxStatus.in_progress,
        leasedBy: 'dead-worker',
        leasedUntil: new Date(Date.now() - 1000)
      }
    });
    await expect(reaper.reapExpiredLeases()).resolves.toBe(1);
    expect(
      await testApp.prisma.fanoutOutbox.findUnique({ where: { requestId: propertyRequestId } })
    ).toMatchObject({
      status: FanoutOutboxStatus.pending,
      leasedBy: null,
      leasedUntil: null
    });
  });

  async function seedUser(role: Role, email: string, isActive = true): Promise<string> {
    const user = await testApp.prisma.user.create({
      data: {
        email,
        displayName: `${role} User`,
        role,
        isActive,
        isVerified: true,
        tokenVersion: 0,
        ...(role === Role.Broker
          ? { brokerProfile: { create: { officeName: `${role} Office` } } }
          : role === Role.Agency
            ? { agencyProfile: { create: { officeName: `${role} Office` } } }
            : {})
      }
    });
    return user.id;
  }

  async function seedToken(userId: string, token: string): Promise<void> {
    await testApp.prisma.deviceToken.create({
      data: { userId, token, deviceType: DeviceType.ios, isActive: true, lastSeenAt: new Date() }
    });
  }

  async function seedRequest(requesterId: string): Promise<string> {
    const city = await seedCity(testApp.prisma, `fanout-city-${Date.now()}`);
    const area = await seedArea(testApp.prisma, city.id, `fanout-area-${Date.now()}`);
    const request = await testApp.prisma.propertyRequest.create({
      data: {
        requesterId,
        title: 'Need a family villa',
        description: 'Looking for a quiet villa near schools.',
        propertyType: 'villa',
        requestType: 'buy',
        cityId: city.id,
        areaId: area.id,
        minPrice: toDecimal(100000),
        maxPrice: toDecimal(300000),
        currency: 'USD',
        requiredRooms: 4,
        approxSizeSqm: 200,
        isUrgent: true,
        contactMethod: 'whatsapp',
        status: 'open'
      }
    });
    return request.id;
  }
});
