import { describe, expect, it } from 'vitest';
import { classifyElementType } from './elementCategory';

describe('classifyElementType', () => {
  it('classifies start events', () => {
    expect(classifyElementType('RequestStart')).toBe('start');
    expect(classifyElementType('SignalStartEvent')).toBe('start');
  });

  it('classifies end events', () => {
    expect(classifyElementType('TaskEnd')).toBe('end');
    expect(classifyElementType('ErrorEnd')).toBe('end');
  });

  it('classifies intermediate and boundary events', () => {
    expect(classifyElementType('TaskSwitchEvent')).toBe('intermediate');
    expect(classifyElementType('ErrorBoundaryEvent')).toBe('boundary');
  });

  it('classifies gateways', () => {
    expect(classifyElementType('Alternative')).toBe('gateway');
    expect(classifyElementType('Split')).toBe('gateway');
    expect(classifyElementType('Join')).toBe('gateway');
  });

  it('classifies containers', () => {
    expect(classifyElementType('EmbeddedProcessElement')).toBe('container');
    expect(classifyElementType('CallableSubProcess')).toBe('container');
  });

  it('classifies annotations', () => {
    expect(classifyElementType('ProcessAnnotation')).toBe('annotation');
  });

  it('falls back to activity for known interface/workflow activities', () => {
    expect(classifyElementType('RestClientCall')).toBe('activity');
    expect(classifyElementType('Script')).toBe('activity');
    expect(classifyElementType('DialogCall')).toBe('activity');
  });

  it('falls back to activity for unknown/future types', () => {
    expect(classifyElementType('SomeFutureV14Type')).toBe('activity');
  });
});
