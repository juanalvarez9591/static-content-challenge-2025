import {
  firstViolation, hasOnlySafeSegments, isNotEmpty, isString, isWithinMaxDepth, isWithinMaxLength,
} from '../page/pathInvariants.js';

const WHOLE_RULES = [['not_a_string', isString]];
const TRIMMED_RULES = [['empty', isNotEmpty], ['too_long', isWithinMaxLength]];
const SEGMENT_RULES = [['too_deep', isWithinMaxDepth], ['invalid_segment', hasOnlySafeSegments]];

export function validatePagePath(input) {
  const wholeViolation = firstViolation(WHOLE_RULES, input);
  if (wholeViolation) return { ok: false, reason: wholeViolation };

  const trimmed = input.trim().replace(/^\/+|\/+$/g, '');
  const trimmedViolation = firstViolation(TRIMMED_RULES, trimmed);
  if (trimmedViolation) return { ok: false, reason: trimmedViolation };

  const segments = trimmed.split('/');
  const segmentViolation = firstViolation(SEGMENT_RULES, segments);
  if (segmentViolation) return { ok: false, reason: segmentViolation };

  return { ok: true, folderPath: segments.join('/') };
}
