import { describe, expect, it } from 'vitest';
import { levelFor } from './wideEvent.js';

describe('levelFor', () => {
  it('maps outcomes to levels', () => {
    expect(levelFor({ status: 200 })).toBe('info');
    expect(levelFor({ status: 404, outcome: 'NOT_FOUND' })).toBe('info');
    expect(levelFor({ status: 404, outcome: 'INVALID_PATH' })).toBe('warn');
    expect(levelFor({ status: 401, auth_outcome: 'INVALID_CREDENTIALS' })).toBe('warn');
    expect(levelFor({ status: 429 })).toBe('warn');
    expect(levelFor({ status: 500 })).toBe('error');
    expect(levelFor({ status: 200, err: {} })).toBe('error');
  });
});
