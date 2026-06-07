import { detectVideoType, isSupportedVideo } from '../../src/infra/objectstore/video-magic.js';

/** Build a buffer whose bytes 4..8 spell `ftyp` and 8..12 carry a brand. */
function ftypBuffer(brand: string): Buffer {
  const head = Buffer.from([0x00, 0x00, 0x00, 0x18]); // box size (ignored)
  const tag = Buffer.from('ftyp', 'ascii');
  const brandBuf = Buffer.from(brand.padEnd(4, ' ').slice(0, 4), 'ascii');
  const rest = Buffer.alloc(4);
  return Buffer.concat([head, tag, brandBuf, rest]);
}

describe('detectVideoType', () => {
  it('detects an MP4 (isom/mp42) ftyp box', () => {
    expect(detectVideoType(ftypBuffer('isom'))).toBe('mp4');
    expect(detectVideoType(ftypBuffer('mp42'))).toBe('mp4');
  });

  it('detects a QuickTime (qt) ftyp box as mov', () => {
    expect(detectVideoType(ftypBuffer('qt'))).toBe('mov');
  });

  it('rejects a PNG header (the image magic bytes)', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(detectVideoType(png)).toBeNull();
    expect(isSupportedVideo(png)).toBe(false);
  });

  it('rejects a serialized JSON Blob descriptor (the RN upload bug)', () => {
    const json = Buffer.from('{"_data":{"size":187}}', 'ascii');
    expect(isSupportedVideo(json)).toBe(false);
  });

  it('rejects a too-short buffer', () => {
    expect(detectVideoType(Buffer.from([0x00, 0x00, 0x00]))).toBeNull();
  });
});
