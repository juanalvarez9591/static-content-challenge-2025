import { describe, expect, it } from 'vitest';
import { imageMarkdown, insertAt, replaceOnce } from './text.js';

describe('editor text helpers', () => {
  it('inserts at the cursor / replaces the selection', () => {
    expect(insertAt('abcd', 2, 2, 'X')).toEqual({ text: 'abXcd', cursor: 3 });
    expect(insertAt('abcd', 1, 3, 'X')).toEqual({ text: 'aXd', cursor: 2 });
  });
  it('replaces only the first occurrence and tolerates a missing one', () => {
    expect(replaceOnce('a-p-p', 'p', 'Q')).toBe('a-Q-p');
    expect(replaceOnce('abc', 'zz', 'Q')).toBe('abc');
  });
  it('builds image markdown', () => expect(imageMarkdown('/uploads/a.png')).toBe('![image](/uploads/a.png)'));
});
