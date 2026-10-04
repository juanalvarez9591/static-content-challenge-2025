import { describe, expect, it } from 'vitest';
import { detectImageType } from './detectImageType.js';
import { UploadOutcome, deriveUploadOutcome } from './deriveUploadOutcome.js';

describe('detectImageType', () => {
  const pad = (bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);
  it('identifies images by magic bytes', () => {
    expect(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).ext).toBe('png');
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0])).ext).toBe('jpg');
    expect(detectImageType(Buffer.from('GIF89a' + '\0'.repeat(10), 'latin1')).ext).toBe('gif');
    expect(detectImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')).ext).toBe('webp');
  });
  it('rejects everything else', () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeUndefined();
    expect(detectImageType(Buffer.from('hello'))).toBeUndefined();
    expect(detectImageType('not a buffer')).toBeUndefined();
  });
});

describe('deriveUploadOutcome', () => {
  it('accepts an image and reports its extension', () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
    expect(deriveUploadOutcome(png)).toMatchObject({ type: UploadOutcome.IMAGE_ACCEPTED, ext: 'png', mime: 'image/png' });
  });
  it('refuses anything that is not an image', () => {
    expect(deriveUploadOutcome(Buffer.from('<script>alert(1)</script>'.padEnd(40))).type).toBe(UploadOutcome.UNSUPPORTED_IMAGE);
    expect(deriveUploadOutcome({}).type).toBe(UploadOutcome.UNSUPPORTED_IMAGE);
  });
});
