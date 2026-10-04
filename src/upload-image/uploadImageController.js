import { HttpStatus } from '../shared/http/status.js';
import { UploadOutcome, deriveUploadOutcome } from './deriveUploadOutcome.js';

export const RESPONSE_BY_OUTCOME = {
  [UploadOutcome.IMAGE_ACCEPTED]: { status: HttpStatus.CREATED },
  [UploadOutcome.UNSUPPORTED_IMAGE]: { status: HttpStatus.UNSUPPORTED_MEDIA_TYPE, error: 'unsupported_image' },
};

export function makeUploadImageController({ uploads }) {
  return async function uploadImage(req, res) {
    const outcome = deriveUploadOutcome(req.body);
    const { status, error } = RESPONSE_BY_OUTCOME[outcome.type];
    if (outcome.type !== UploadOutcome.IMAGE_ACCEPTED) return res.status(status).json({ error });

    const name = await uploads.save(req.body, outcome.ext);
    res.locals.event.admin_action = 'image_uploaded';
    res.locals.event.image_bytes = req.body.length;
    return res.status(status).json({ url: `/uploads/${name}` });
  };
}
