import { useRef, type ChangeEvent } from 'react';

export interface FileOpenButtonProps {
  label: string;
  onLoad: (text: string, fileName: string) => void;
}

export function FileOpenButton({ label, onLoad }: FileOpenButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onLoad(text, file.name);
    event.target.value = '';
  };

  return (
    <>
      <button type="button" className="toolbar-button" onClick={() => inputRef.current?.click()}>
        {label}
      </button>
      <input ref={inputRef} type="file" accept=".json,.p.json,application/json" style={{ display: 'none' }} onChange={handleChange} />
    </>
  );
}
