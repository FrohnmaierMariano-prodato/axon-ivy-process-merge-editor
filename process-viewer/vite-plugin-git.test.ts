import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { safeRelativePath } from './vite-plugin-git';

const root = path.resolve('/repo');

describe('safeRelativePath', () => {
  it('accepts a tracked p.json inside the repo', () => {
    expect(safeRelativePath(root, 'Main.p.json')).toBe('Main.p.json');
    expect(safeRelativePath(root, 'sub/Other.p.json')).toBe('sub/Other.p.json');
  });

  it('rejects path traversal outside the repo', () => {
    expect(safeRelativePath(root, '../secrets.p.json')).toBeUndefined();
    expect(safeRelativePath(root, '../../etc/passwd.json')).toBeUndefined();
  });

  it('rejects non-json files', () => {
    expect(safeRelativePath(root, 'Main.ts')).toBeUndefined();
    expect(safeRelativePath(root, '')).toBeUndefined();
  });

  it('rejects absolute paths that escape the repo', () => {
    expect(safeRelativePath(root, path.resolve('/elsewhere/x.json'))).toBeUndefined();
  });
});
