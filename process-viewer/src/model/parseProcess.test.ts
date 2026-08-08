import { describe, expect, it } from 'vitest';
import { flattenElements, parseProcess, parseProcessText, ProcessParseError } from './parseProcess';
import demoDoc from '../fixtures/DocumentExample.p.json';

describe('parseProcess', () => {
  it('parses the DocumentExample fixture', () => {
    const doc = parseProcess(demoDoc);
    expect(doc.id).toBe('19A44F7C9FFFD445');
    expect(doc.elements).toHaveLength(6);
  });

  it('flattens all elements by id', () => {
    const doc = parseProcess(demoDoc);
    const ids = flattenElements(doc.elements).map(el => el.id).sort();
    expect(ids).toEqual(['f0', 'f1', 'f12', 'f3', 'f6', 'f7']);
  });

  it('throws a ProcessParseError when "elements" is missing', () => {
    expect(() => parseProcess({ id: 'ABC' })).toThrow(ProcessParseError);
  });

  it('throws a ProcessParseError when the root is not an object', () => {
    expect(() => parseProcess('not an object')).toThrow(ProcessParseError);
  });

  it('is tolerant of unknown element types (future/v14 files)', () => {
    const doc = parseProcess({
      id: 'ABC',
      elements: [{ id: 'x1', type: 'SomeFutureV14Type', config: { foo: 'bar' } }]
    });
    expect(doc.elements[0]?.type).toBe('SomeFutureV14Type');
  });

  it('parseProcessText rejects invalid JSON with a clear error', () => {
    expect(() => parseProcessText('{not valid json')).toThrow(ProcessParseError);
  });
});
