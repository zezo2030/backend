import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { LocationType } from './location.enums.js';

export interface LocationDto {
  id: string;
  name: string;
  type: LocationType;
  parentId: string | null;
  slug: string;
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCities(): Promise<LocationDto[]> {
    const rows = await this.prisma.location.findMany({
      where: { type: LocationType.City, isActive: true },
      orderBy: { name: 'asc' }
    });
    return rows.map((row) => this.toDto(row));
  }

  async listAreas(cityId: string): Promise<LocationDto[]> {
    const city = await this.prisma.location.findFirst({
      where: { id: cityId, type: LocationType.City, isActive: true }
    });
    if (!city) {
      throw new BadRequestException({ code: 'invalidLocationId', message: 'Invalid city id' });
    }
    const rows = await this.prisma.location.findMany({
      where: { type: LocationType.Area, parentId: cityId, isActive: true },
      orderBy: { name: 'asc' }
    });
    return rows.map((row) => this.toDto(row));
  }

  async assertAreaBelongsToCity(areaId: string, cityId: string): Promise<void> {
    const area = await this.prisma.location.findFirst({
      where: { id: areaId, type: LocationType.Area, isActive: true }
    });
    if (!area || area.parentId !== cityId) {
      throw new BadRequestException({ code: 'areaCityMismatch', message: 'Area does not belong to city' });
    }
  }

  async findById(id: string): Promise<LocationDto> {
    const row = await this.prisma.location.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Location not found');
    return this.toDto(row);
  }

  private toDto(row: {
    id: string;
    name: string;
    type: LocationType;
    parentId: string | null;
    slug: string;
  }): LocationDto {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      parentId: row.parentId,
      slug: row.slug
    };
  }
}
