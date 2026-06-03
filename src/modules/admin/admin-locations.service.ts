import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { LocationType } from '../locations/location.enums.js';
import type { CreateAreaDto, CreateCityDto, UpdateLocationDto } from './dto/admin-locations.dto.js';

export interface LocationAdminDto {
  id: string;
  name: string;
  slug: string;
  type: LocationType;
  parentId: string | null;
  isActive: boolean;
}

@Injectable()
export class AdminLocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCity(dto: CreateCityDto): Promise<LocationAdminDto> {
    try {
      const created = await this.prisma.location.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          type: LocationType.City,
          parentId: null,
          isActive: true
        }
      });
      return this.toDto(created);
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async createArea(dto: CreateAreaDto): Promise<LocationAdminDto> {
    const parent = await this.prisma.location.findFirst({
      where: { id: dto.parentId, type: LocationType.City }
    });
    if (!parent) {
      throw new UnprocessableEntityException({
        code: 'parentNotFound',
        message: 'parent city does not exist'
      });
    }
    try {
      const created = await this.prisma.location.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          type: LocationType.Area,
          parentId: parent.id,
          isActive: true
        }
      });
      return this.toDto(created);
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async update(id: string, dto: UpdateLocationDto): Promise<LocationAdminDto> {
    try {
      const updated = await this.prisma.location.update({
        where: { id },
        data: dto
      });
      return this.toDto(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Location not found');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) throw new NotFoundException('Location not found');

    if (location.type === LocationType.City) {
      const childAreas = await this.prisma.location.findMany({
        where: { parentId: id },
        select: { id: true }
      });
      const childAreaIds = childAreas.map((area) => area.id);
      const inUse =
        (await this.prisma.property.count({
          where: {
            deletedAt: null,
            OR: [{ cityId: id }, { areaId: { in: childAreaIds } }]
          }
        })) > 0 ||
        (await this.prisma.propertyRequest.count({
          where: {
            deletedAt: null,
            OR: [{ cityId: id }, { areaId: { in: childAreaIds } }]
          }
        })) > 0;
      if (inUse) {
        await this.prisma.location.updateMany({
          where: { OR: [{ id }, { parentId: id }] },
          data: { isActive: false }
        });
        return;
      }
      await this.prisma.location.deleteMany({
        where: { OR: [{ id }, { parentId: id }] }
      });
      return;
    }

    const referenced =
      (await this.prisma.property.count({ where: { areaId: id, deletedAt: null } })) > 0 ||
      (await this.prisma.propertyRequest.count({ where: { areaId: id, deletedAt: null } })) > 0;
    if (referenced) {
      await this.prisma.location.update({ where: { id }, data: { isActive: false } });
      return;
    }
    await this.prisma.location.delete({ where: { id } });
  }

  private toDto(row: {
    id: string;
    name: string;
    slug: string;
    type: LocationType;
    parentId: string | null;
    isActive: boolean;
  }): LocationAdminDto {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      parentId: row.parentId,
      isActive: row.isActive
    };
  }

  private translateError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException({
        code: 'duplicateLocation',
        message: 'A location with this slug already exists in this scope'
      });
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
