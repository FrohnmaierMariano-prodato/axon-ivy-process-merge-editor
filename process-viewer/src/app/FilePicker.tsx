import { useEffect, useMemo, useRef, useState } from 'react';

function basename(p: string): string {
  return p.split('/').pop() ?? p;
}

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(0, i) : '';
}

interface TreeNode {
  name: string;
  fullPath: string;
  isFile: boolean;
  children: TreeNode[];
}

function buildTree(files: string[]): TreeNode {
  const root: TreeNode = { name: '', fullPath: '', isFile: false, children: [] };
  for (const file of files) {
    const parts = file.split('/');
    let node = root;
    let acc = '';
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isFile = i === parts.length - 1;
      let child = node.children.find(c => c.name === part && c.isFile === isFile);
      if (!child) {
        child = { name: part, fullPath: acc, isFile, children: [] };
        node.children.push(child);
      }
      node = child;
    });
  }
  return sortAndCompact(root);
}

// Folders before files, alphabetical; merge single-child folder chains for compactness.
function sortAndCompact(node: TreeNode): TreeNode {
  node.children = node.children.map(sortAndCompact).sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  if (node.fullPath && !node.isFile && node.children.length === 1 && !node.children[0].isFile) {
    const only = node.children[0];
    return { name: `${node.name}/${only.name}`, fullPath: only.fullPath, isFile: false, children: only.children };
  }
  return node;
}

function ancestorFolders(file: string): string[] {
  const parts = file.split('/');
  const folders: string[] = [];
  let acc = '';
  for (let i = 0; i < parts.length - 1; i++) {
    acc = acc ? `${acc}/${parts[i]}` : parts[i];
    folders.push(acc);
  }
  return folders;
}

export interface FilePickerProps {
  files: string[];
  value: string;
  onChange: (file: string) => void;
}

const MAX_RESULTS = 200;

/** Searchable file picker: a collapsible folder tree while browsing, flat substring search while typing. */
export function FilePicker({ files, value, onChange }: FilePickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => buildTree(files), [files]);

  const searching = query.trim().length > 0;

  const { results, total } = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches =
      terms.length === 0 ? files : files.filter(f => terms.every(t => f.toLowerCase().includes(t)));
    return { results: matches.slice(0, MAX_RESULTS), total: matches.length };
  }, [files, query]);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const openPicker = () => {
    setQuery('');
    // Reveal the currently selected file in the tree.
    setExpanded(prev => new Set([...prev, ...(value ? ancestorFolders(value) : [])]));
    setOpen(true);
  };

  const select = (file: string) => {
    onChange(file);
    setQuery('');
    setOpen(false);
  };

  const toggleFolder = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      openPicker();
      return;
    }
    if (!searching) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const file = results[activeIndex];
      if (file) select(file);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const renderTree = (node: TreeNode, depth: number): React.ReactNode =>
    node.children.map(child => {
      const indent = { paddingLeft: 8 + depth * 14 };
      if (child.isFile) {
        return (
          <li
            key={child.fullPath}
            role="option"
            aria-selected={child.fullPath === value}
            className={'file-picker__row file-picker__file' + (child.fullPath === value ? ' file-picker__file--current' : '')}
            style={indent}
            title={child.fullPath}
            onPointerDown={e => {
              e.preventDefault();
              select(child.fullPath);
            }}
          >
            <span className="file-picker__icon">📄</span>
            <span className="file-picker__name">{child.name}</span>
          </li>
        );
      }
      const isOpen = expanded.has(child.fullPath);
      return (
        <li key={child.fullPath} className="file-picker__group">
          <div
            className="file-picker__row file-picker__folder"
            style={indent}
            onPointerDown={e => {
              e.preventDefault();
              toggleFolder(child.fullPath);
            }}
          >
            <span className="file-picker__icon">{isOpen ? '▾' : '▸'}</span>
            <span className="file-picker__folder-name">{child.name}</span>
          </div>
          {isOpen && <ul className="file-picker__sublist">{renderTree(child, depth + 1)}</ul>}
        </li>
      );
    });

  return (
    <div className="file-picker" ref={rootRef}>
      <input
        className="file-picker__input"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-label="Search process file"
        placeholder={value ? basename(value) : 'Search or browse *.p.json…'}
        title={value}
        value={open ? query : value ? basename(value) : ''}
        onFocus={openPicker}
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="file-picker__list" role="listbox">
          {searching ? (
            <>
              {results.length === 0 && <li className="file-picker__empty">No matching files</li>}
              {results.map((f, i) => (
                <li
                  key={f}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={
                    'file-picker__item' +
                    (i === activeIndex ? ' file-picker__item--active' : '') +
                    (f === value ? ' file-picker__item--current' : '')
                  }
                  onMouseEnter={() => setActiveIndex(i)}
                  onPointerDown={e => {
                    e.preventDefault();
                    select(f);
                  }}
                >
                  <span className="file-picker__name">{basename(f)}</span>
                  <span className="file-picker__dir">{dirname(f)}</span>
                </li>
              ))}
              {total > results.length && (
                <li className="file-picker__more">
                  Showing {results.length} of {total} — refine your search
                </li>
              )}
            </>
          ) : files.length === 0 ? (
            <li className="file-picker__empty">No tracked *.p.json files</li>
          ) : (
            renderTree(tree, 0)
          )}
        </ul>
      )}
    </div>
  );
}
