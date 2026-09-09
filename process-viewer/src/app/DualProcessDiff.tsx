import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ProcessCanvas } from '../canvas/ProcessCanvas';
import { DetailPanel } from './DetailPanel';
import { flattenElements } from '../model/parseProcess';
import { diffProcess } from '../diff/diffProcess';
import { childDocument, getElementReference, getJumpInfo } from '../model/jumpTarget';
import { hasHiddenChildren } from '../icons/activityBadge';
import { useSidebarWidth } from './useSidebarWidth';
import { useCanvasOrientation } from './useCanvasOrientation';
import { useSplitRatio } from './useSplitRatio';
import type { ProcessDocument, ProcessElement } from '../model/schema-types';

/** One level of the navigation stack: the two documents being diffed plus their pane/breadcrumb labels. */
export interface DiffFrame {
  left?: ProcessDocument;
  right?: ProcessDocument;
  leftLabel: string;
  rightLabel: string;
  /** Short label shown in the breadcrumb. */
  crumb: string;
}

/** Result of resolving a cross-file jump: either a frame to push, or a note explaining why it couldn't. */
export interface JumpResult {
  frame?: DiffFrame;
  note?: string;
}

export interface DualProcessDiffProps {
  left?: ProcessDocument;
  right?: ProcessDocument;
  leftLabel: string;
  rightLabel: string;
  /** Breadcrumb label for the base (props) frame. */
  rootLabel?: string;
  /** View-specific controls rendered at the start of the toolbar. */
  toolbar: ReactNode;
  /**
   * Resolves a cross-file jump (e.g. a SubProcessCall target) to a frame. Views that can load other
   * files (the git diff view) provide this; without it only in-place drill-down (collapsed BPMN) works.
   */
  resolveJump?: (reference: string) => Promise<JumpResult> | JumpResult;
}

function elementLabel(element: ProcessElement): string {
  if (Array.isArray(element.name)) return element.name.join(' / ');
  return element.name || element.type;
}

/** Shared two-pane diff rendering used by both the upload diff view and the git diff view. */
export function DualProcessDiff({ left, right, leftLabel, rightLabel, rootLabel, toolbar, resolveJump }: DualProcessDiffProps) {
  const [selectedId, setSelectedId] = useState<string>();
  const [frames, setFrames] = useState<DiffFrame[]>([]);
  const [note, setNote] = useState<string>();
  const { width: sidebarWidth, isDragging, onHandlePointerDown } = useSidebarWidth();
  const { orientation, toggleOrientation } = useCanvasOrientation();
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const { ratio: splitRatio, isDragging: isSplitDragging, onHandlePointerDown: onSplitPointerDown } = useSplitRatio(splitContainerRef, orientation);

  const baseFrame = useMemo<DiffFrame>(
    () => ({ left, right, leftLabel, rightLabel, crumb: rootLabel ?? 'Process' }),
    [left, right, leftLabel, rightLabel, rootLabel]
  );

  // A new file/ref (base frame changes) resets any drilled-in navigation.
  useEffect(() => {
    setFrames([baseFrame]);
    setSelectedId(undefined);
    setNote(undefined);
  }, [baseFrame]);

  const current = frames[frames.length - 1] ?? baseFrame;

  const diff = useMemo(
    () => (current.left && current.right ? diffProcess(current.left, current.right) : undefined),
    [current]
  );

  const selectedElement = useMemo(() => {
    if (!selectedId) return undefined;
    const fromLeft = current.left && flattenElements(current.left.elements).find(el => el.id === selectedId);
    const fromRight = current.right && flattenElements(current.right.elements).find(el => el.id === selectedId);
    return fromRight ?? fromLeft;
  }, [current, selectedId]);

  const selectedDiffEntry = selectedId ? diff?.elements.get(selectedId) : undefined;

  // Drills into a collapsed BPMN activity's embedded content, or jumps into a referenced process
  // file (via the injected resolver) - mirrors the single view / Designer shortcut.
  const jumpFromElement = useCallback(
    (element: ProcessElement) => {
      if (hasHiddenChildren(element.type) && element.elements && element.elements.length > 0) {
        const childLeft = current.left && childDocument(current.left, element.id);
        const childRight = current.right && childDocument(current.right, element.id);
        setFrames(prev => [
          ...prev,
          {
            left: childLeft,
            right: childRight,
            leftLabel: current.leftLabel,
            rightLabel: current.rightLabel,
            crumb: elementLabel(element)
          }
        ]);
        setSelectedId(undefined);
        setNote(undefined);
        return;
      }

      const reference = getElementReference(element);
      if (!reference) return;
      if (!resolveJump) {
        setNote('Cross-file jumps are only available in the git diff view.');
        return;
      }
      void Promise.resolve(resolveJump(reference)).then(result => {
        if (result.frame) {
          setFrames(prev => [...prev, result.frame!]);
          setSelectedId(undefined);
          setNote(undefined);
        } else {
          setNote(result.note ?? `Could not resolve "${reference}".`);
        }
      });
    },
    [current, resolveJump]
  );

  // "J" triggers the jump for the selected element.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'j' && event.key !== 'J') return;
      const target = event.target as HTMLElement | null;
      if (target && /^(input|textarea)$/i.test(target.tagName)) return;
      if (selectedElement) jumpFromElement(selectedElement);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, jumpFromElement]);

  const jumpInfo = selectedElement ? getJumpInfo(selectedElement) : undefined;

  const jumpToFrame = (index: number) => {
    setFrames(prev => prev.slice(0, index + 1));
    setSelectedId(undefined);
    setNote(undefined);
  };

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
      {(frames.length > 1 || note) && (
        <div className="breadcrumb">
          {frames.length > 1 &&
            frames.map((frame, i) => (
              <span key={i} className="breadcrumb__segment">
                {i > 0 && <span className="breadcrumb__sep">›</span>}
                <button className="breadcrumb__button" disabled={i === frames.length - 1} onClick={() => jumpToFrame(i)}>
                  {frame.crumb}
                </button>
              </span>
            ))}
          {note && <span className="toolbar__message">{note}</span>}
        </div>
      )}
      <div className="view__body">
        <div
          ref={splitContainerRef}
          className={`view__canvas view__canvas--split${orientation === 'vertical' ? ' view__canvas--split-vertical' : ''}`}
        >
          <div className="split-pane" style={{ flex: `0 0 ${splitRatio * 100}%` }}>
            <div className="split-pane__label">{current.leftLabel}</div>
            {current.left && <ProcessCanvas key={`l${frames.length}`} document={current.left} diff={diff} onSelectElement={setSelectedId} />}
          </div>
          <div
            className={`split-divider${isSplitDragging ? ' split-divider--active' : ''}`}
            onPointerDown={onSplitPointerDown}
            role="separator"
            aria-orientation={orientation === 'vertical' ? 'horizontal' : 'vertical'}
            aria-label="Resize diff panes"
          />
          <div className="split-pane">
            <div className="split-pane__label">{current.rightLabel}</div>
            {current.right && <ProcessCanvas key={`r${frames.length}`} document={current.right} diff={diff} onSelectElement={setSelectedId} />}
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
          <DetailPanel
            element={selectedElement}
            diffEntry={selectedDiffEntry}
            onJump={jumpInfo && selectedElement ? () => jumpFromElement(selectedElement) : undefined}
            jumpLabel={jumpInfo?.label}
          />
        </div>
      </div>
    </div>
  );
}
