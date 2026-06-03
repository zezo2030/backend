export class OffsetPageInfoDto {
  page!: number;
  pageSize!: number;
  totalItems!: number;
  totalPages!: number;
}

export class OffsetPageDto<T> {
  items!: T[];
  pageInfo!: OffsetPageInfoDto;
}
