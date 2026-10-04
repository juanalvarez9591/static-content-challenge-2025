import {
  firstViolation, hasNoBackslash, hasNoDotSegments, hasNoEmptySegments, hasNoNullByte, isAbsolute,
} from '../page/pathInvariants.js';

export const Outcome = Object.freeze({
  PAGE_FOUND: 'PAGE_FOUND',
  SITEMAP: 'SITEMAP',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_PATH: 'INVALID_PATH',
});

export const RESERVED_SITEMAP_PATH = '/sitemap';

const URL_RULES = [
  ['not_absolute', isAbsolute],
  ['null_byte', hasNoNullByte],
  ['backslash', hasNoBackslash],
];
const SEGMENT_RULES = [
  ['path_escapes_content_root', hasNoDotSegments],
  ['empty_segment', hasNoEmptySegments],
];
const invalid = (reason) => ({ type: Outcome.INVALID_PATH, reason });

export function deriveRouteOutcome(urlPath, knownFolders) {
  const urlViolation = firstViolation(URL_RULES, urlPath);
  if (urlViolation) return invalid(urlViolation);

  const trimmed = urlPath.length > 1 && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;
  if (trimmed === '/') {
    return knownFolders.includes('') ? { type: Outcome.PAGE_FOUND, folderPath: '' } : { type: Outcome.NOT_FOUND };
  }
  if (trimmed === RESERVED_SITEMAP_PATH) return { type: Outcome.SITEMAP };

  const segments = trimmed.slice(1).split('/');
  const segmentViolation = firstViolation(SEGMENT_RULES, segments);
  if (segmentViolation) return invalid(segmentViolation);

  const folderPath = segments.join('/');
  return knownFolders.includes(folderPath) ? { type: Outcome.PAGE_FOUND, folderPath } : { type: Outcome.NOT_FOUND };
}

export function deriveResponseOutcome(routeOutcome, page) {
  if (routeOutcome.type === Outcome.PAGE_FOUND && page === undefined) {
    return { type: Outcome.NOT_FOUND, reason: 'page_unreadable' };
  }
  return routeOutcome;
}
