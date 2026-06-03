import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Role } from '../../common/enums/role.enum.js';
import { toDecimal } from '../../common/prisma/decimal.util.js';
import { AuditLogger } from '../../common/logging/audit-logger.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { ObjectStoreService } from '../../infra/objectstore/object-store.service.js';
import type {
  MinePropertiesQueryDto,
  PropertyAvailabilityDto,
  PropertyCreateDto,
  PropertyUpdateDto
} from './dto/property-write.dto.js';
import { PropertiesQueryService, type PropertyWithImages } from './properties.query.service.js';
import {
  AvailabilityStatus,
  ModerationStatus,
  type PropertyImageRecord
} from './property.enums.js';

const MODERATION_RELEVANT_FIELDS = new Set<keyof PropertyUpdateDto>([
  'title',
  'description',
  'price',
  'imageObjectKeys'
]);

@Injectable()
export class PropertiesCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStore: ObjectStoreService,
    private readonly auditLogger: AuditLogger,
    private readonly query: PropertiesQueryService
  ) {}

  async create(dto: PropertyCreateDto, ownerId: string): Promise<ReturnType<PropertiesQueryService['mapDto']>> {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { role: true }
    });
    if (!owner?.role) throw new ForbiddenException('Account has no role');

    const images = await this.headImages(dto.imageObjectKeys);
    const moderationStatus =
      owner.role === Role.RegularUser ? ModerationStatus.pending_review : ModerationStatus.active;

    const created = await this.prisma.$transaction(async (tx) => {
      return tx.property.create({
        data: {
          ownerId,
          title: dto.title,
          description: dto.description,
          propertyType: dto.propertyType,
          listingType: dto.listingType,
          price: toDecimal(dto.price),
          currency: dto.currency,
          cityId: dto.cityId,
          areaId: dto.areaId,
          address: dto.address ?? null,
          rooms: dto.rooms,
          bathrooms: dto.bathrooms,
          sizeSqm: dto.sizeSqm,
          floor: dto.floor ?? null,
          finishing: dto.finishing ?? null,
          furnished: dto.furnished ?? null,
          moderationStatus,
          availabilityStatus: AvailabilityStatus.available,
          rejectionReason: null,
          viewsCount: 0,
          ownerIsActive: true,
          images: {
            create: images.map((img) => ({
              objectKey: img.objectKey,
              contentType: img.contentType,
              sizeBytes: img.sizeBytes,
              sortOrder: img.sortOrder,
              uploadedAt: img.uploadedAt
            }))
          }
        },
        include: { images: true }
      });
    });

    await this.auditLogger.log({
      actorUserId: ownerId,
      action: 'listing.created',
      targetType: 'property',
      targetId: created.id,
      metadata: { moderationStatus }
    });

    return this.query.mapDto(created);
  }

  async update(
    id: string,
    dto: PropertyUpdateDto,
    callerId: string
  ): Promise<ReturnType<PropertiesQueryService['mapDto']>> {
    const property = await this.findOwnedOrAdmin(id, callerId);
    const callerRole = await this.lookupRole(callerId);

    const data: Prisma.PropertyUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = toDecimal(dto.price);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.cityId !== undefined) data.city = { connect: { id: dto.cityId } };
    if (dto.areaId !== undefined) data.area = { connect: { id: dto.areaId } };
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.rooms !== undefined) data.rooms = dto.rooms;
    if (dto.bathrooms !== undefined) data.bathrooms = dto.bathrooms;
    if (dto.sizeSqm !== undefined) data.sizeSqm = dto.sizeSqm;
    if (dto.floor !== undefined) data.floor = dto.floor;
    if (dto.finishing !== undefined) data.finishing = dto.finishing;
    if (dto.furnished !== undefined) data.furnished = dto.furnished;

    if (
      callerRole === Role.RegularUser &&
      property.moderationStatus === ModerationStatus.active &&
      this.touchesModeration(dto)
    ) {
      data.moderationStatus = ModerationStatus.pending_review;
      data.rejectionReason = null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.imageObjectKeys !== undefined) {
        const images = await this.headImages(dto.imageObjectKeys);
        await tx.propertyImage.deleteMany({ where: { propertyId: property.id } });
        await tx.propertyImage.createMany({
          data: images.map((img) => ({
            propertyId: property.id,
            objectKey: img.objectKey,
            contentType: img.contentType,
            sizeBytes: img.sizeBytes,
            sortOrder: img.sortOrder,
            uploadedAt: img.uploadedAt
          }))
        });
      }
      return tx.property.update({
        where: { id: property.id },
        data,
        include: { images: true }
      });
    });

    return this.query.mapDto(updated);
  }

  async updateAvailability(
    id: string,
    dto: PropertyAvailabilityDto,
    callerId: string
  ): Promise<ReturnType<PropertiesQueryService['mapDto']>> {
    const property = await this.findOwnedOrAdmin(id, callerId);
    const updated = await this.prisma.property.update({
      where: { id: property.id },
      data: { availabilityStatus: dto.availabilityStatus },
      include: { images: true }
    });
    return this.query.mapDto(updated);
  }

  async softDelete(id: string, callerId: string): Promise<void> {
    const property = await this.findOwnedOrAdmin(id, callerId);
    await this.prisma.property.update({
      where: { id: property.id },
      data: { deletedAt: new Date() }
    });
    await this.auditLogger.log({
      actorUserId: callerId,
      action: 'listing.deleted',
      targetType: 'property',
      targetId: property.id
    });
  }

  async listMine(callerId: string, query: MinePropertiesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where = { ownerId: callerId, deletedAt: null };
    const [docs, totalItems] = await Promise.all([
      this.prisma.property.findMany({
        where,
        include: { images: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.property.count({ where })
    ]);

    const items = await Promise.all(docs.map((doc) => this.query.mapDto(doc)));
    return {
      items,
      pageInfo: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) }
    };
  }

  private async headImages(objectKeys: string[]): Promise<PropertyImageRecord[]> {
    const now = new Date();
    const images: PropertyImageRecord[] = [];
    for (let index = 0; index < objectKeys.length; index += 1) {
      const objectKey = objectKeys[index]!;
      const head = await this.objectStore.head(objectKey);
      if (!head) {
        throw new UnprocessableEntityException({
          code: 'uploadMissing',
          message: `Object not found in storage: ${objectKey}`
        });
      }
      images.push({
        objectKey,
        contentType: head.contentType,
        sizeBytes: head.sizeBytes,
        sortOrder: index,
        uploadedAt: now
      });
    }
    return images;
  }

  private async findOwnedOrAdmin(id: string, callerId: string): Promise<PropertyWithImages> {
    const property = await this.prisma.property.findFirst({
      where: { id, deletedAt: null },
      include: { images: true }
    });
    if (!property) throw new NotFoundException('Property not found');

    if (property.ownerId === callerId) return property;
    const callerRole = await this.lookupRole(callerId);
    if (callerRole === Role.Admin) return property;
    throw new ForbiddenException('Forbidden');
  }

  private async lookupRole(callerId: string): Promise<Role | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { role: true }
    });
    return (user?.role as Role | null) ?? null;
  }

  private touchesModeration(dto: PropertyUpdateDto): boolean {
    for (const field of MODERATION_RELEVANT_FIELDS) {
      if (dto[field] !== undefined) return true;
    }
    return false;
  }
}
