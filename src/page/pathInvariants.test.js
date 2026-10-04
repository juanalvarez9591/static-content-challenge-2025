import { describe, expect, it } from 'vitest';
import * as inv from './pathInvariants.js';

describe('read-side invariants', () => {
  it('isAbsolute', () => {
    expect(inv.isAbsolute('/a')).toBe(true);
    expect(inv.isAbsolute('a')).toBe(false);
    expect(inv.isAbsolute(undefined)).toBe(false);
  });
  it('hasNoNullByte / hasNoBackslash', () => {
    expect(inv.hasNoNullByte('/a')).toBe(true);
    expect(inv.hasNoNullByte('/a\0')).toBe(false);
    expect(inv.hasNoBackslash('/a\\b')).toBe(false);
  });
  it('hasNoDotSegments / hasNoEmptySegments', () => {
    expect(inv.hasNoDotSegments(['a', '..'])).toBe(false);
    expect(inv.hasNoDotSegments(['.', 'a'])).toBe(false);
    expect(inv.hasNoDotSegments(['a', 'b'])).toBe(true);
    expect(inv.hasNoEmptySegments(['a', ''])).toBe(false);
  });
});

describe('write-side invariants', () => {
  it('hasOnlySafeSegments', () => {
    expect(inv.hasOnlySafeSegments(['blog', 'my_post-1'])).toBe(true);
    for (const bad of ['Up', '-x', '.x', 'a b', 'a.md', '%2e']) expect(inv.hasOnlySafeSegments([bad])).toBe(false);
  });
  it('size limits', () => {
    expect(inv.isWithinMaxDepth(Array(inv.MAX_SEGMENTS).fill('a'))).toBe(true);
    expect(inv.isWithinMaxDepth(Array(inv.MAX_SEGMENTS + 1).fill('a'))).toBe(false);
    expect(inv.isWithinMaxLength('a'.repeat(inv.MAX_LENGTH + 1))).toBe(false);
  });
});

describe('firstViolation', () => {
  const rules = [['first', (v) => v > 0], ['second', (v) => v < 10]];
  it('reports the first rule that fails, or nothing', () => {
    expect(firstOf(5)).toBeUndefined();
    expect(firstOf(-1)).toBe('first');
    expect(firstOf(20)).toBe('second');
  });
  const firstOf = (v) => inv.firstViolation(rules, v);
});
