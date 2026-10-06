import { describe, expect, it } from 'vitest';
import { adjacentFile } from './fileNavigation';

const conflicts = ['a.p.json', 'b.p.json', 'c.p.json'];

describe('adjacentFile', () => {
  it('returns undefined when there are no conflicts', () => {
    expect(adjacentFile([], 'a.p.json', 1)).toBeUndefined();
  });

  it('moves forward and backward through conflicts', () => {
    expect(adjacentFile(conflicts, 'b.p.json', 1)).toBe('c.p.json');
    expect(adjacentFile(conflicts, 'b.p.json', -1)).toBe('a.p.json');
  });

  it('wraps at both ends', () => {
    expect(adjacentFile(conflicts, 'c.p.json', 1)).toBe('a.p.json');
    expect(adjacentFile(conflicts, 'a.p.json', -1)).toBe('c.p.json');
  });

  it('selects the first or last conflict from a non-conflicted file', () => {
    expect(adjacentFile(conflicts, 'other.p.json', 1)).toBe('a.p.json');
    expect(adjacentFile(conflicts, 'other.p.json', -1)).toBe('c.p.json');
  });

  it('keeps a single conflict selected', () => {
    expect(adjacentFile(['a.p.json'], 'a.p.json', 1)).toBe('a.p.json');
    expect(adjacentFile(['a.p.json'], 'a.p.json', -1)).toBe('a.p.json');
  });
});