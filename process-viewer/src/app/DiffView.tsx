import { useState } from 'react';
import { DualProcessDiff } from './DualProcessDiff';
import { FileOpenButton } from './FileOpenButton';
import { parseProcess, parseProcessText, ProcessParseError } from '../model/parseProcess';
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

  const toolbar = (
    <>
      <FileOpenButton label="Open left .p.json" onLoad={handleLoad('left')} />
      <span className="toolbar__filename">{leftName}</span>
      {errors.left && <span className="toolbar__error">{errors.left}</span>}
      <FileOpenButton label="Open right .p.json" onLoad={handleLoad('right')} />
      <span className="toolbar__filename">{rightName}</span>
      {errors.right && <span className="toolbar__error">{errors.right}</span>}
    </>
  );

  return <DualProcessDiff left={left} right={right} leftLabel="Left" rightLabel="Right" toolbar={toolbar} />;
}
