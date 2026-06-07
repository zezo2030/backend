/**
 * Authoritative video detection by magic bytes — the parallel of `image-magic.ts`.
 * Never trust the stored Content-Type: it is client-supplied and was the source
 * of a past RN upload bug (a serialized Blob descriptor stored with a media
 * Content-Type). The leading bytes do not lie.
 */
export type DetectedVideoType = 'mp4' | 'mov';

/**
 * ISO base-media (MP4 / QuickTime .mov) files begin with a `ftyp` box:
 * 4-byte big-endian box size, then the ASCII tag `ftyp` at offset 4.
 */
export function detectVideoType(buf: Buffer): DetectedVideoType | null {
  if (buf.length < 12) {
    return null;
  }
  if (buf.subarray(4, 8).toString('ascii') !== 'ftyp') {
    return null;
  }
  // Major brand at offset 8 (e.g. "isom", "mp42", "qt  ", "M4V ").
  const brand = buf.subarray(8, 12).toString('ascii');
  if (brand.startsWith('qt')) {
    return 'mov';
  }
  return 'mp4';
}

export const isSupportedVideo = (buf: Buffer): boolean => detectVideoType(buf) !== null;
