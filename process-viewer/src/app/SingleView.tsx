import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProcessCanvas } from '../canvas/ProcessCanvas';
import { DetailPanel } from './DetailPanel';
import { FileOpenButton } from './FileOpenButton';
import { FolderOpenButton, type FolderFile } from './FolderOpenButton';
import { flattenElements, parseProcess, parseProcessText, ProcessParseError } from '../model/parseProcess';
import { ProcessRegistry } from '../model/processRegistry';
import { childDocument, getElementReference, getJumpInfo } from '../model/jumpTarget';
import { hasHiddenChildren } from '../icons/activityBadge';
import { useSidebarWidth } from './useSidebarWidth';
import type { ProcessDocument, ProcessElement } from '../model/schema-types';
import demoDoc from '../fixtures/DocumentExample.p.json';

interface Frame {
  doc: ProcessDocument;
  label: string;
}

function elementLabel(element: ProcessElement): string {
  if (Array.isArray(element.name)) return element.name.join(' / ');
  return element.name || element.type;
}

export function SingleView() {
  const [frames, setFrames] = useState<Frame[]>(() => [{ doc: parseProcess(demoDoc), label: 'DocumentExample.p.json (bundled demo)' }]);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const registryRef = useRef(new ProcessRegistry());
  const { width: sidebarWidth, isDragging, onHandlePointerDown } = useSidebarWidth();

  const current = frames[frames.length - 1];

  const handleLoad = (text: string, name: string) => {
    try {
      const parsed = parseProcessText(text);
      registryRef.current.register(name, parsed);
      setFrames([{ doc: parsed, label: name }]);
      setError(undefined);
      setMessage(undefined);
      setSelectedId(undefined);
    } catch (e) {
      const message = e instanceof ProcessParseError ? e.message : `Unexpected error: ${(e as Error).message}`;
      setError(message);
    }
  };

  const handleFolderFiles = (files: FolderFile[]) => {
    let added = 0;
    for (const file of files) {
      try {
        registryRef.current.register(file.path, parseProcessText(file.text));
        added++;
      } catch {
        // Not every JSON file in a folder is necessarily a valid .p.json - skip silently.
      }
    }
    setMessage(`Added ${added} process file${added === 1 ? '' : 's'} from folder (usable as J-jump targets).`);
  };

  const selectedElement = useMemo(() => {
    if (!current || !selectedId) return undefined;
    return flattenElements(current.doc.elements).find(el => el.id === selectedId);
  }, [current, selectedId]);

  // Jumps into a SubProcessCall/TriggerCall/DialogCall/UserTask target file, or one level deeper
  // into a collapsed BPMN activity's embedded content - mirrors the Designer shortcut.
  const jumpFromElement = useCallback(
    (element: ProcessElement) => {
      if (hasHiddenChildren(element.type) && element.elements && element.elements.length > 0) {
        const childDoc = childDocument(current.doc, element.id);
        if (childDoc) {
          setFrames(prev => [...prev, { doc: childDoc, label: elementLabel(element) }]);
          setSelectedId(undefined);
          setMessage(undefined);
        }
        return;
      }

      const reference = getElementReference(element);
      if (!reference) return;
      const resolved = registryRef.current.resolve(reference);
      if (resolved) {
        setFrames(prev => [...prev, { doc: resolved.doc, label: resolved.path }]);
        setSelectedId(undefined);
        setMessage(undefined);
      } else {
        setMessage(`Open "${reference}.p.json" (via "Open file" or "Open folder") to jump there.`);
      }
    },
    [current]
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
    setMessage(undefined);
  };

  return (
    <div className="view view--single">
      <div className="toolbar">
        <FileOpenButton label="Open .p.json" onLoad={handleLoad} />
        <FolderOpenButton label="Open folder…" onFiles={handleFolderFiles} />
        {frames.length === 1 && <span className="toolbar__filename">{current.label}</span>}
        {error && <span className="toolbar__error">{error}</span>}
        {message && <span className="toolbar__message">{message}</span>}
      </div>
      {frames.length > 1 && (
        <div className="breadcrumb">
          {frames.map((frame, i) => (
            <span key={i} className="breadcrumb__segment">
              {i > 0 && <span className="breadcrumb__sep">›</span>}
              <button className="breadcrumb__button" disabled={i === frames.length - 1} onClick={() => jumpToFrame(i)}>
                {frame.label}
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="view__body">
        <div className="view__canvas">
          {current && <ProcessCanvas key={frames.length} document={current.doc} onSelectElement={setSelectedId} />}
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
            onJump={jumpInfo && selectedElement ? () => jumpFromElement(selectedElement) : undefined}
            jumpLabel={jumpInfo?.label}
          />
        </div>
      </div>
    </div>
  );
}
