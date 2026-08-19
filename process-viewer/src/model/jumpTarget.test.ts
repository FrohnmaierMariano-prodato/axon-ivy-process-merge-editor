import { describe, expect, it } from 'vitest';
import { extractProcessReference, resolveProcessPath, ProcessRegistry } from './processRegistry';
import { getElementReference, childDocument } from './jumpTarget';
import { getJumpInfo } from './jumpTarget';
import type { ProcessDocument, ProcessElement } from './schema-types';

const REPO_FILES = [
  'aps-internals-common/processes/aps/internal/common/technicalProcesses/CaseMapHsaPruefung/Stage3Anmeldephase/GruppenlaufzeitAbwarten.p.json',
  'aps-internals-common/processes/aps/internal/common/technicalProcesses/system/CallableSubprocesses/Statusupdates.p.json',
  'aps-internals-common/processes/aps/internal/common/technicalProcesses/CaseMapHsaPruefung/GruppenlaufzeitAbgelaufen.p.json'
];

describe('resolveProcessPath', () => {
  it('resolves a slash-separated processCall reference (SubProcessCall/TriggerCall style)', () => {
    const ref = extractProcessReference('aps/internal/common/technicalProcesses/system/CallableSubprocesses/Statusupdates:regularHsaCasemapEnd(Boolean)');
    expect(resolveProcessPath(ref!, REPO_FILES)).toBe(REPO_FILES[1]);
  });

  it('resolves a dot-separated dialog reference (DialogCall style)', () => {
    const ref = extractProcessReference('aps.internals.common.technicalProcesses.CaseMapHsaPruefung.GruppenlaufzeitAbgelaufen:start()');
    expect(resolveProcessPath(ref!, REPO_FILES)).toBe(REPO_FILES[2]);
  });

  it('resolves an HTML dialog reference to its `.../<Dialog>/<Dialog>Process.p.json` file', () => {
    const files = [
      'aps-internals-common/src_hd/aps/internals/common/technicalProcesses/CaseMapHsaPruefung/GruppenlaufzeitAbgelaufen/GruppenlaufzeitAbgelaufenProcess.p.json'
    ];
    const ref = extractProcessReference('aps.internals.common.technicalProcesses.CaseMapHsaPruefung.GruppenlaufzeitAbgelaufen:start()');
    expect(resolveProcessPath(ref!, files)).toBe(files[0]);
  });

  it('returns undefined when nothing shares the final segment', () => {
    expect(resolveProcessPath('some/other/Thing', REPO_FILES)).toBeUndefined();
  });

  it('is used by ProcessRegistry.resolve for slash references too', () => {
    const registry = new ProcessRegistry();
    const doc: ProcessDocument = { id: 'x', elements: [] };
    registry.register(REPO_FILES[1], doc);
    const ref = extractProcessReference('aps/internal/common/technicalProcesses/system/CallableSubprocesses/Statusupdates:regularHsaCasemapEnd(Boolean)');
    expect(registry.resolve(ref!)?.path).toBe(REPO_FILES[1]);
  });
});

describe('getElementReference', () => {
  it('reads processCall for SubProcessCall and TriggerCall', () => {
    const sub: ProcessElement = { id: 'a', type: 'SubProcessCall', config: { processCall: 'a/b/C:call()' } };
    const trigger: ProcessElement = { id: 'b', type: 'TriggerCall', config: { processCall: 'x.y.Z:start()' } };
    expect(getElementReference(sub)).toBe('a/b/C');
    expect(getElementReference(trigger)).toBe('x.y.Z');
  });

  it('reads dialog for DialogCall', () => {
    const dialog: ProcessElement = { id: 'c', type: 'DialogCall', config: { dialog: 'a.b.Form:start()' } };
    expect(getElementReference(dialog)).toBe('a.b.Form');
  });

  it('reads dialog for UserTask', () => {
    const userTask: ProcessElement = { id: 'ut', type: 'UserTask', config: { dialog: 'a.b.c.SomeForm:start()' } };
    expect(getElementReference(userTask)).toBe('a.b.c.SomeForm');
  });

  it('returns undefined for non-jumpable elements', () => {
    expect(getElementReference({ id: 'd', type: 'Script' })).toBeUndefined();
  });
});

describe('getJumpInfo', () => {
  it('describes a called-process jump for SubProcessCall/TriggerCall', () => {
    const sub: ProcessElement = { id: 'a', type: 'SubProcessCall', config: { processCall: 'a/b/C:call()' } };
    expect(getJumpInfo(sub)).toEqual({ kind: 'file', label: 'Open called process', reference: 'a/b/C' });
  });

  it('describes a dialog-process jump for DialogCall and UserTask', () => {
    const dialog: ProcessElement = { id: 'c', type: 'DialogCall', config: { dialog: 'a.b.Form:start()' } };
    const userTask: ProcessElement = { id: 'ut', type: 'UserTask', config: { dialog: 'a.b.Form:start()' } };
    expect(getJumpInfo(dialog)?.label).toBe('Open dialog process');
    expect(getJumpInfo(userTask)?.label).toBe('Open dialog process');
  });

  it('describes an embedded-process jump for a collapsed BPMN activity with content', () => {
    const bpmn: ProcessElement = { id: 'b', type: 'ScriptBpmnElement', elements: [{ id: 'x', type: 'Script' }] };
    expect(getJumpInfo(bpmn)).toEqual({ kind: 'embedded', label: 'Open embedded process' });
  });

  it('returns undefined for a collapsed BPMN activity with no embedded content', () => {
    expect(getJumpInfo({ id: 'b', type: 'ScriptBpmnElement' })).toBeUndefined();
  });

  it('returns undefined for elements with no connected resource', () => {
    expect(getJumpInfo({ id: 'd', type: 'Script' })).toBeUndefined();
  });
});

describe('childDocument', () => {
  it('extracts a collapsed element\'s embedded elements into a sub-document', () => {
    const child: ProcessElement = { id: 'inner', type: 'Script' };
    const doc: ProcessDocument = {
      id: 'root',
      elements: [{ id: 'outer', type: 'ScriptBpmnElement', elements: [child] }]
    };
    const sub = childDocument(doc, 'outer');
    expect(sub?.id).toBe('outer');
    expect(sub?.elements).toEqual([child]);
  });

  it('returns undefined when the element has no embedded content', () => {
    const doc: ProcessDocument = { id: 'root', elements: [{ id: 'plain', type: 'Script' }] };
    expect(childDocument(doc, 'plain')).toBeUndefined();
  });
});
