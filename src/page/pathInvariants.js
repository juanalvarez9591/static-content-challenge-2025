
export const isAbsolute = (p) => typeof p === 'string' && p.startsWith('/');
export const hasNoNullByte = (p) => !p.includes('\0');
export const hasNoBackslash = (p) => !p.includes('\\');
export const hasNoDotSegments = (segments) => !segments.some((s) => s === '..' || s === '.');
export const hasNoEmptySegments = (segments) => !segments.some((s) => s === '');

const SEGMENT = /^[a-z0-9][a-z0-9_-]*$/;
export const MAX_SEGMENTS = 8;
export const MAX_LENGTH = 200;
export const isString = (p) => typeof p === 'string';
export const isNotEmpty = (p) => p !== '';
export const isWithinMaxLength = (p) => p.length <= MAX_LENGTH;
export const isWithinMaxDepth = (segments) => segments.length <= MAX_SEGMENTS;
export const hasOnlySafeSegments = (segments) => segments.every((s) => SEGMENT.test(s));

export function firstViolation(rules, value) {
  const failed = rules.find(([, holds]) => !holds(value));
  return failed?.[0];
}
