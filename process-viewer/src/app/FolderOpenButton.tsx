import { useRef, type ChangeEvent } from 'react';

export interface FolderFile {
  /** Relative path within the chosen folder, e.g. "financial/tracker/part3/exampleSub.p.json". */
  path: string;
  text: string;
}

export interface FolderOpenButtonProps {
  label: string;
  onFiles: (files: FolderFile[]) => void;
}

/**
 * Lets the user pick a whole folder (searched recursively, including nested subdirectories) so
 * that `.p.json`/`.json` files inside it can be registered for resolving `SubProcessCall`
 * references by name. Uses the widely-supported `webkitdirectory` file input attribute rather
 * than the Chromium-only File System Access API, so it also works in Firefox/Safari.
 */
export function FolderOpenButton({ label, onFiles }: FolderOpenButtonProps) {
  const inputElRef = useRef<HTMLInputElement | null>(null);

  const setInputRef = (el: HTMLInputElement | null) => {
    inputElRef.current = el;
    if (el) {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    }
  };

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    event.target.value = '';
    if (!fileList || fileList.length === 0) return;

    const jsonFiles = Array.from(fileList).filter(file => /\.(p\.json|json)$/i.test(file.name));
    const files = await Promise.all(
      jsonFiles.map(async file => ({
        path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        text: await file.text()
      }))
    );
    onFiles(files);
  };

  return (
    <>
      <button type="button" className="toolbar-button" onClick={() => inputElRef.current?.click()}>
        {label}
      </button>
      <input ref={setInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleChange} />
    </>
  );
}
