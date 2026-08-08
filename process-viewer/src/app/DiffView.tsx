import { useMemo, useState } from 'react';
import { ProcessCanvas } from '../canvas/ProcessCanvas';
import { DetailPanel } from './DetailPanel';
import { FileOpenButton } from './FileOpenButton';
import { flattenElements, parseProcess, parseProcessText, ProcessParseError } from '../model/parseProcess';
import { diffProcess } from '../diff/diffProcess';
import { useSidebarWidth } from './useSidebarWidth';
import type { ProcessDocument } from '../model/schema-types';
import leftDemoDoc from '../fixtures/DocumentExample.p.json';
import rightDemoDoc from '../fixtures/DocumentExample.modified.p.json';

type Side = 'left' | 'right';

export function DiffView() {
  const [left, setLeft] = useState<ProcessDocument | undefined>(() => parseProcess(leftDemoDoc));
  const [right, setRight] = useState<ProcessDocument | undefined>(() => parseProcess(rightDemoDoc));
  const [leftName, setLeftName] = useState('DocumentExample.p.json (bundled demo)');
  const [rightName, setRightName] = useState('DocumentExample.modified.p.json (bundled demo)');
  const [errors, setErrors] = useState<Partial<Record<Side, string>>>({});
  const [selectedId, setSelectedId] = useState<string>();
  const { width: sidebarWidth, isDragging, onHandlePointerDown } = useSidebarWidth();

  const diff = useMemo(() => (left && right ? diffProcess(left, right) : undefined), [left, right]);

  const handleLoad = (side: Side) => (text: string, name: string) => {
    try {
      const parsed = parseProcessText(text);
      if (side === 'left') {
        setLeft(parsed);
        setLeftName(name);
      } else {
        setRight(parsed);
        setRightName(name);
      }
      setErrors(prev => ({ ...prev, [side]: undefined }));
    } catch (e) {
      const message = e instanceof ProcessParseError ? e.message : `Unexpected error: ${(e as Error).message}`;
      setErrors(prev => ({ ...prev, [side]: message }));
    }
  };

  const selectedElement = useMemo(() => {
    if (!selectedId) return undefined;
    const fromLeft = left && flattenElements(left.elements).find(el => el.id === selectedId);
    const fromRight = right && flattenElements(right.elements).find(el => el.id === selectedId);
    return fromRight ?? fromLeft;
  }, [left, right, selectedId]);

  const selectedDiffEntry = selectedId ? diff?.elements.get(selectedId) : undefined;

  return (
    <div className="view view--diff">
      <div className="toolbar">
        <FileOpenButton label="Open left .p.json" onLoad={handleLoad('left')} />
        <span className="toolbar__filename">{leftName}</span>
        {errors.left && <span className="toolbar__error">{errors.left}</span>}
        <FileOpenButton label="Open right .p.json" onLoad={handleLoad('right')} />
        <span className="toolbar__filename">{rightName}</span>
        {errors.right && <span className="toolbar__error">{errors.right}</span>}
      </div>
      <div className="view__body">
        <div className="view__canvas view__canvas--split">
          <div className="split-pane">
            <div className="split-pane__label">Left</div>
            {left && <ProcessCanvas document={left} diff={diff} onSelectElement={setSelectedId} />}
          </div>
          <div className="split-pane">
            <div className="split-pane__label">Right</div>
            {right && <ProcessCanvas document={right} diff={diff} onSelectElement={setSelectedId} />}
          </div>
        </div>
        <div
          className={`sidebar-resize-handle${isDragging ? ' sidebar-resize-handle--active' : ''}`}
          onPointerDown={onHandlePointerDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize detail sidebar"
        />
        <div className="view__sidebar" style={{ width: sidebarWidth }}>
          <DetailPanel element={selectedElement} diffEntry={selectedDiffEntry} />
        </div>
      </div>
    </div>
  );
}
