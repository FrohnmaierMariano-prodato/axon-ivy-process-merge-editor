import { describe, expect, it } from 'vitest';
import { parseProcess } from '../model/parseProcess';
import { diffProcess } from './diffProcess';
import leftDoc from '../fixtures/DocumentExample.p.json';
import rightDoc from '../fixtures/DocumentExample.modified.p.json';

describe('diffProcess', () => {
  const left = parseProcess(leftDoc);
  const right = parseProcess(rightDoc);
  const diff = diffProcess(left, right);

  it('flags an unchanged element as unchanged', () => {
    expect(diff.elements.get('f0')?.status).toBe('unchanged');
  });

  it('flags a position-only change as moved', () => {
    expect(diff.elements.get('f1')?.status).toBe('moved');
  });

  it('flags a config change as modified and reports the changed path', () => {
    const entry = diff.elements.get('f3');
    expect(entry?.status).toBe('modified');
    expect(entry?.changedPaths).toContain('target.path');
  });

  it('flags a mapping-table change as modified and reports the changed map entries', () => {
    const entry = diff.elements.get('f7');
    expect(entry?.status).toBe('modified');
    expect(entry?.changedPaths?.some(path => path.startsWith('call.map'))).toBe(true);
  });

  it('flags a code change as modified', () => {
    expect(diff.elements.get('f6')?.status).toBe('modified');
  });

  it('flags a removed element as removed', () => {
    expect(diff.elements.get('f12')?.status).toBe('removed');
  });

  it('flags a new element as added', () => {
    expect(diff.elements.get('f9')?.status).toBe('added');
  });

  it('flags a rewired connector as modified', () => {
    expect(diff.connectors.get('f6::f8')?.status).toBe('modified');
    expect(diff.connectors.get('f3::f4')?.status).toBe('modified');
  });

  it('flags an unchanged connector as unchanged', () => {
    expect(diff.connectors.get('f0::f2')?.status).toBe('unchanged');
    expect(diff.connectors.get('f7::f5')?.status).toBe('unchanged');
  });

  it('flags a connector on a removed element as removed', () => {
    expect(diff.connectors.get('f12::f13')?.status).toBe('removed');
  });

  it('flags a new connector as added', () => {
    expect(diff.connectors.get('f9::f10')?.status).toBe('added');
  });
});
