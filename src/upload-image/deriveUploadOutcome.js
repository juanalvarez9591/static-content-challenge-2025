import { detectImageType } from './detectImageType.js';

export const UploadOutcome = Object.freeze({ IMAGE_ACCEPTED: 'IMAGE_ACCEPTED', UNSUPPORTED_IMAGE: 'UNSUPPORTED_IMAGE' });

export function deriveUploadOutcome(body) {
  const type = detectImageType(body);
  return type ? { type: UploadOutcome.IMAGE_ACCEPTED, ...type } : { type: UploadOutcome.UNSUPPORTED_IMAGE };
}
