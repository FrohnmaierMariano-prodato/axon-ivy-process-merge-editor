import { describe, expect, it } from 'vitest';
import { buildMapDiffTree, diffCodeLines, diffParams, groupChangedPathsBySection, mapNodeStatus, unionKeys } from './configDiff';

describe('buildMapDiffTree / mapNodeStatus', () => {
  it('classifies unchanged, changed, added and removed mapping rows', () => {
    const left = { 'out.audioFile': 'param.audioFile', 'out.old': 'x' };
    const right = { 'out.audioFile': 'param.audioFile2', 'out.new': 'y' };
    const tree = buildMapDiffTree(left, right);
    const byPath = new Map(tree.flatMap(function flatten(node): [string, typeof node][] {
      return [[node.path, node], ...node.children.flatMap(flatten)];
    }));

    expect(mapNodeStatus(byPath.get('out')!)).toBe('unchanged'); // "out" itself has no own value
    expect(mapNodeStatus(byPath.get('out.audioFile')!)).toBe('changed');
    expect(mapNodeStatus(byPath.get('out.old')!)).toBe('removed');
    expect(mapNodeStatus(byPath.get('out.new')!)).toBe('added');
  });
});

describe('diffParams', () => {
  it('matches params by name and classifies added/removed/changed/unchanged', () => {
    const left = [
      { name: 'a', type: 'String', desc: 'A' },
      { name: 'b', type: 'int', desc: 'B' }
    ];
    const right = [
      { name: 'a', type: 'String', desc: 'A' },
      { name: 'b', type: 'long', desc: 'B' },
      { name: 'c', type: 'boolean', desc: 'C' }
    ];
    const rows = diffParams(left, right);
    expect(rows.find(r => r.name === 'a')?.status).toBe('unchanged');
    expect(rows.find(r => r.name === 'b')?.status).toBe('changed');
    expect(rows.find(r => r.name === 'c')?.status).toBe('added');

    const removed = diffParams(left, [left[0]]);
    expect(removed.find(r => r.name === 'b')?.status).toBe('removed');
  });
});

describe('diffCodeLines', () => {
  it('produces unchanged/added/removed lines via LCS', () => {
    const left = ['a', 'b', 'c'];
    const right = ['a', 'x', 'c'];
    const lines = diffCodeLines(left, right);
    expect(lines.map(l => `${l.status}:${l.text}`)).toEqual(['unchanged:a', 'removed:b', 'added:x', 'unchanged:c']);
  });

  it('handles string vs string[] and undefined sides', () => {
    expect(diffCodeLines('a\nb', ['a', 'b'])).toEqual([
      { status: 'unchanged', text: 'a' },
      { status: 'unchanged', text: 'b' }
    ]);
    expect(diffCodeLines(undefined, ['a'])).toEqual([{ status: 'added', text: 'a' }]);
    expect(diffCodeLines(['a'], undefined)).toEqual([{ status: 'removed', text: 'a' }]);
  });
});

describe('groupChangedPathsBySection', () => {
  it('groups by top-level dot segment and counts occurrences', () => {
    const counts = groupChangedPathsBySection(['map.out.a', 'map.out.b', 'code', 'target.path']);
    expect(counts.get('map')).toBe(2);
    expect(counts.get('code')).toBe(1);
    expect(counts.get('target')).toBe(1);
  });
});

describe('unionKeys', () => {
  it('preserves left order then appends new right-only keys', () => {
    expect(unionKeys({ a: 1, b: 2 }, { b: 3, c: 4 })).toEqual(['a', 'b', 'c']);
  });
});
