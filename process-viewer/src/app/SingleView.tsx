import { useMemo, useState } from 'react';
import { ProcessCanvas } from '../canvas/ProcessCanvas';
import { DetailPanel } from './DetailPanel';
import { FileOpenButton } from './FileOpenButton';
import { flattenElements, parseProcess, parseProcessText, ProcessParseError } from '../model/parseProcess';
import type { ProcessDocument } from '../model/schema-types';
import demoDoc from '../fixtures/DocumentExample.p.json';

export function SingleView() {
  const [doc, setDoc] = useState<ProcessDocument | undefined>(() => parseProcess(demoDoc));
  const [fileName, setFileName] = useState('DocumentExample.p.json (bundled demo)');
  const [error, setError] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();

  const handleLoad = (text: string, name: string) => {
    try {
      const parsed = parseProcessText(text);
      setDoc(parsed);
      setFileName(name);
      setError(undefined);
      setSelectedId(undefined);
    } catch (e) {
      const message = e instanceof ProcessParseError ? e.message : `Unexpected error: ${(e as Error).message}`;
      setError(message);
    }
  };

  const selectedElement = useMemo(() => {
    if (!doc || !selectedId) return undefined;
    return flattenElements(doc.elements).find(el => el.id === selectedId);
  }, [doc, selectedId]);

  return (
    <div className="view view--single">
      <div className="toolbar">
        <FileOpenButton label="Open .p.json" onLoad={handleLoad} />
        <span className="toolbar__filename">{fileName}</span>
        {error && <span className="toolbar__error">{error}</span>}
      </div>
      <div className="view__body">
        <div className="view__canvas">{doc && <ProcessCanvas document={doc} onSelectElement={setSelectedId} />}</div>
        <div className="view__sidebar">
          <DetailPanel element={selectedElement} />
        </div>
      </div>
    </div>
  );
}
