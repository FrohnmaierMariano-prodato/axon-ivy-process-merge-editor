import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { safeRelativePath, parseStatusPorcelain } from './vite-plugin-git';

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

describe('parseStatusPorcelain', () => {
  it('classifies modified, added, deleted and untracked *.p.json files', () => {
    const stdout = [
      ' M sub/Modified.p.json',
      'A  New.p.json',
      ' D sub/Gone.p.json',
      '?? Untracked.p.json',
      ''
    ].join('\n');
    expect(parseStatusPorcelain(stdout)).toEqual([
      { path: 'sub/Modified.p.json', status: 'modified' },
      { path: 'New.p.json', status: 'added' },
      { path: 'sub/Gone.p.json', status: 'deleted' },
      { path: 'Untracked.p.json', status: 'untracked' }
    ]);
  });

  it('uses the destination path for renames', () => {
    const stdout = 'R  old/Old.p.json -> new/New.p.json\n';
    expect(parseStatusPorcelain(stdout)).toEqual([{ path: 'new/New.p.json', status: 'renamed' }]);
  });

  it('unquotes paths and ignores non-p.json entries', () => {
    const stdout = ' M "sub dir/With Space.p.json"\n M other.ts\n';
    expect(parseStatusPorcelain(stdout)).toEqual([
      { path: 'sub dir/With Space.p.json', status: 'modified' }
    ]);
  });
});
