import { Role } from '@prisma/client';
import { AdminReportsService } from '../../src/modules/reports/admin-reports.service.js';
import {
  ReportResolveActionDto,
  ReportResolveOutcome
} from '../../src/modules/reports/dto/reports.dto.js';
import { ReportTargetReconciler } from '../../src/modules/reports/report-target-reconciler.service.js';
import { ReportsService } from '../../src/modules/reports/reports.service.js';
import { ReportStatus, ReportTargetType } from '../../src/modules/reports/schemas/report.schema.js';
import { closeAuthTestApp, createAuthTestApp, type AuthTestApp } from '../helpers/auth-test-app.js';
import { seedArea, seedCity, seedProperty, truncateAllTables } from '../helpers/test-db.js';
describe('Reports services (integration)', () => {
  let testApp: AuthTestApp;
  let reports: ReportsService;
  let adminReports: AdminReportsService;
  let reconciler: ReportTargetReconciler;

  beforeAll(async () => {
    testApp = await createAuthTestApp();
    reports = testApp.app.get(ReportsService);
    adminReports = testApp.app.get(AdminReportsService);
    reconciler = testApp.app.get(ReportTargetReconciler);
  });

  afterAll(async () => {
    await closeAuthTestApp(testApp);
  });

  beforeEach(async () => {
    await truncateAllTables(testApp.prisma);
  });

  it('create rejects an unknown target', async () => {
    const reporter = await seedUser('u5554000000@test.local', Role.RegularUser);
    await expect(
      reports.create(
        {
          targetType: ReportTargetType.Property,
          targetId: 'clnonexistent000000000000000',
          reason: 'spam listing'
        },
        reporter
      )
    ).rejects.toMatchObject({ status: 422 });
  });

  it('create persists a report and audit row when target exists', async () => {
    const reporterId = await seedUser('u5554000001@test.local', Role.RegularUser);
    const ownerId = await seedUser('u5554000002@test.local', Role.Broker);
    const propertyId = await seedPropertyForOwner(ownerId);

    const dto = await reports.create(
      {
        targetType: ReportTargetType.Property,
        targetId: propertyId,
        reason: 'misleading photos'
      },
      reporterId
    );

    expect(dto.status).toBe(ReportStatus.Open);
    expect(dto.targetDeleted).toBe(false);
    expect(dto.reporterId).toBe(reporterId);

    const audit = await testApp.prisma.auditEvent.findFirst({
      where: { action: 'report.created' }
    });
    expect(audit).not.toBeNull();
  });

  it('resolve with disabled_account disables target user atomically', async () => {
    const reporterId = await seedUser('u5554000010@test.local', Role.RegularUser);
    const targetUserId = await seedUser('u5554000011@test.local', Role.Broker);
    await seedPropertyForOwner(targetUserId);

    const created = await reports.create(
      {
        targetType: ReportTargetType.Broker,
        targetId: targetUserId,
        reason: 'fraudulent listings'
      },
      reporterId
    );

    const adminId = await seedUser('u5554000012@test.local', Role.Admin);
    const resolved = await adminReports.resolve(
      created.id,
      { outcome: ReportResolveOutcome.Resolved, action: ReportResolveActionDto.DisabledAccount },
      adminId
    );

    expect(resolved.status).toBe(ReportStatus.Resolved);
    expect(resolved.resolvedAction).toBe('disabled_account');

    const target = await testApp.prisma.user.findUnique({ where: { id: targetUserId } });
    expect(target?.isActive).toBe(false);
    expect(target?.tokenVersion).toBeGreaterThan(0);

    const properties = await testApp.prisma.property.findMany({ where: { ownerId: targetUserId } });
    expect(properties.every((property) => property.ownerIsActive === false)).toBe(true);
  });

  it('resolve with deleted_listing soft-deletes the listing atomically', async () => {
    const reporterId = await seedUser('u5554000020@test.local', Role.RegularUser);
    const ownerId = await seedUser('u5554000021@test.local', Role.Broker);
    const propertyId = await seedPropertyForOwner(ownerId);

    const created = await reports.create(
      {
        targetType: ReportTargetType.Property,
        targetId: propertyId,
        reason: 'duplicate listing'
      },
      reporterId
    );

    const adminId = await seedUser('u5554000022@test.local', Role.Admin);
    const resolved = await adminReports.resolve(
      created.id,
      { outcome: ReportResolveOutcome.Resolved, action: ReportResolveActionDto.DeletedListing },
      adminId
    );

    expect(resolved.status).toBe(ReportStatus.Resolved);
    expect(resolved.resolvedAction).toBe('deleted_listing');

    const property = await testApp.prisma.property.findUnique({ where: { id: propertyId } });
    expect(property?.deletedAt).toBeInstanceOf(Date);
  });

  it('reconciler flips targetDeleted when the target is soft-deleted', async () => {
    const reporterId = await seedUser('u5554000030@test.local', Role.RegularUser);
    const ownerId = await seedUser('u5554000031@test.local', Role.Broker);
    const propertyId = await seedPropertyForOwner(ownerId);

    await reports.create(
      {
        targetType: ReportTargetType.Property,
        targetId: propertyId,
        reason: 'fake'
      },
      reporterId
    );

    await testApp.prisma.property.update({
      where: { id: propertyId },
      data: { deletedAt: new Date() }
    });

    const flagged = await reconciler.reconcile();
    expect(flagged).toBeGreaterThanOrEqual(1);

    const report = await testApp.prisma.report.findFirst();
    expect(report?.targetDeleted).toBe(true);
  });

  async function seedUser(email: string, role: Role): Promise<string> {
    const user = await testApp.prisma.user.create({
      data: {
        email,
        displayName: email,
        role,
        isActive: true,
        isVerified: true,
        tokenVersion: 0,
        ...(role === Role.Broker
          ? { brokerProfile: { create: { officeName: `Broker ${email}` } } }
          : role === Role.Agency
            ? { agencyProfile: { create: { officeName: `Agency ${email}` } } }
            : {})
      }
    });
    return user.id;
  }

  async function seedPropertyForOwner(ownerId: string): Promise<string> {
    const city = await seedCity(testApp.prisma, `report-city-${Date.now()}`);
    const area = await seedArea(testApp.prisma, city.id, `report-area-${Date.now()}`);
    const created = await seedProperty(testApp.prisma, {
      ownerId,
      title: 'Sample',
      propertyType: 'apartment',
      listingType: 'sale',
      price: 150000,
      city: city.id,
      area: area.id,
      rooms: 2,
      furnished: 'unfurnished',
      createdAt: new Date(),
      objectKeySuffix: `report-${Date.now()}`
    });
    return created.id;
  }
});
