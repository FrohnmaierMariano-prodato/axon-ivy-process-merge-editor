import { useMemo, useState, type ReactNode } from 'react';
import { ProcessCanvas } from '../canvas/ProcessCanvas';
import { DetailPanel } from './DetailPanel';
import { flattenElements } from '../model/parseProcess';
import { diffProcess } from '../diff/diffProcess';
import { useSidebarWidth } from './useSidebarWidth';
import { useCanvasOrientation } from './useCanvasOrientation';
import type { ProcessDocument } from '../model/schema-types';

export interface DualProcessDiffProps {
  left?: ProcessDocument;
  right?: ProcessDocument;
  leftLabel: string;
  rightLabel: string;
  /** View-specific controls rendered at the start of the toolbar. */
  toolbar: ReactNode;
}

/** Shared two-pane diff rendering used by both the upload diff view and the git diff view. */
export function DualProcessDiff({ left, right, leftLabel, rightLabel, toolbar }: DualProcessDiffProps) {
  const [selectedId, setSelectedId] = useState<string>();
  const { width: sidebarWidth, isDragging, onHandlePointerDown } = useSidebarWidth();
  const { orientation, toggleOrientation } = useCanvasOrientation();

  const diff = useMemo(() => (left && right ? diffProcess(left, right) : undefined), [left, right]);

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
        {toolbar}
        <button
          type="button"
          className="toolbar-button"
          onClick={toggleOrientation}
          aria-label="Toggle diff layout orientation"
        >
          {orientation === 'horizontal' ? 'Stack vertically' : 'Side by side'}
        </button>
      </div>
      <div className="view__body">
        <div className={`view__canvas view__canvas--split${orientation === 'vertical' ? ' view__canvas--split-vertical' : ''}`}>
          <div className="split-pane">
            <div className="split-pane__label">{leftLabel}</div>
            {left && <ProcessCanvas document={left} diff={diff} onSelectElement={setSelectedId} />}
          </div>
          <div className="split-pane">
            <div className="split-pane__label">{rightLabel}</div>
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
