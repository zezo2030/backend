export class CursorPageDto<T> {
  items!: T[];
  nextCursor?: string | null;
}
