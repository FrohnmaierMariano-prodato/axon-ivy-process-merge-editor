import { useCallback, useEffect, useMemo, useState } from 'react';
import { DualProcessDiff } from './DualProcessDiff';
import { FilePicker } from './FilePicker';
import { parseProcessText, ProcessParseError } from '../model/parseProcess';
import { HttpGitProvider, WORKING_TREE, type ChangeStatus, type GitCommit, type GitRef } from '../git/gitProvider';
import type { ProcessDocument } from '../model/schema-types';

const HEAD_REF = 'HEAD';

function refLabel(ref: GitRef, commits: GitCommit[]): string {
  if (ref === WORKING_TREE) return 'Working tree (uncommitted)';
  if (ref === HEAD_REF) return 'HEAD (latest commit)';
  const commit = commits.find(c => c.hash === ref);
  return commit ? `${commit.shortHash} — ${commit.subject}` : ref;
}

function initialFileFromUrl(): string {
  return new URLSearchParams(window.location.search).get('file') ?? '';
}

function repoFromUrl(): string | undefined {
  return new URLSearchParams(window.location.search).get('repo') ?? undefined;
}

function basename(p: string): string {
  return p.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? p;
}

// Stand-in for a file that does not exist at a ref, so the diff renders as fully added/removed.
const EMPTY_DOCUMENT: ProcessDocument = { id: '(absent)', elements: [] };

export function GitDiffView() {
  const [repo, setRepo] = useState<string | undefined>(() => repoFromUrl());
  const [repoInput, setRepoInput] = useState<string>(() => repoFromUrl() ?? '');
  const provider = useMemo(() => new HttpGitProvider({ repo }), [repo]);
  const [files, setFiles] = useState<string[]>([]);
  const [file, setFile] = useState<string>(() => initialFileFromUrl());
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [changed, setChanged] = useState<Map<string, ChangeStatus>>(new Map());
  const [baseRef, setBaseRef] = useState<GitRef>(HEAD_REF);
  const [targetRef, setTargetRef] = useState<GitRef>(WORKING_TREE);
  const [left, setLeft] = useState<ProcessDocument>();
  const [right, setRight] = useState<ProcessDocument>();
  const [errors, setErrors] = useState<Partial<Record<'base' | 'target' | 'general', string>>>({});
  const [notes, setNotes] = useState<Partial<Record<'base' | 'target', string>>>({});
  const [loading, setLoading] = useState(false);

  // Load the list of tracked process files once.
  useEffect(() => {
    provider
      .listFiles()
      .then(list => {
        setFiles(list);
        setFile(current => current || list[0] || '');
      })
      .catch(e => setErrors(prev => ({ ...prev, general: (e as Error).message })));
  }, [provider]);

  // Load which files have local changes so the picker can highlight them.
  useEffect(() => {
    provider
      .listChangedFiles()
      .then(list => setChanged(new Map(list.map(c => [c.path, c.status]))))
      .catch(() => setChanged(new Map()));
  }, [provider]);

  // Untracked *.p.json aren't returned by listFiles; surface them in the picker too.
  const pickerFiles = useMemo(() => {
    const set = new Set(files);
    for (const path of changed.keys()) set.add(path);
    return [...set];
  }, [files, changed]);

  // Refresh commit history whenever the selected file changes.
  useEffect(() => {
    if (!file) {
      setCommits([]);
      return;
    }
    provider
      .listCommits(file)
      .then(list => {
        setCommits(list);
        setErrors(prev => ({ ...prev, general: undefined }));
      })
      .catch(e => setErrors(prev => ({ ...prev, general: (e as Error).message })));
  }, [file, provider]);

  const loadSide = useCallback(
    async (ref: GitRef, side: 'base' | 'target') => {
      try {
        const text = await provider.readAtRef(file, ref);
        const parsed = text === null ? EMPTY_DOCUMENT : parseProcessText(text);
        if (side === 'base') setLeft(parsed);
        else setRight(parsed);
        setErrors(prev => ({ ...prev, [side]: undefined }));
        setNotes(prev => ({ ...prev, [side]: text === null ? 'file not present at this version' : undefined }));
      } catch (e) {
        const message = e instanceof ProcessParseError ? e.message : (e as Error).message;
        if (side === 'base') setLeft(undefined);
        else setRight(undefined);
        setErrors(prev => ({ ...prev, [side]: message }));
        setNotes(prev => ({ ...prev, [side]: undefined }));
      }
    },
    [file, provider]
  );

  // Reload both sides whenever the file or either ref changes.
  useEffect(() => {
    if (!file) {
      setLeft(undefined);
      setRight(undefined);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([loadSide(baseRef, 'base'), loadSide(targetRef, 'target')]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [file, baseRef, targetRef, loadSide]);

  const baseOptions = useMemo<GitRef[]>(() => [HEAD_REF, ...commits.map(c => c.hash)], [commits]);
  const targetOptions = useMemo<GitRef[]>(() => [WORKING_TREE, HEAD_REF, ...commits.map(c => c.hash)], [commits]);

  // Switch to a different local repo entered manually; reset the file so it picks a valid one.
  const applyRepo = () => {
    const next = repoInput.trim() || undefined;
    if (next !== repo) {
      setRepo(next);
      setFile('');
    }
  };

  const repoName = repo ? basename(repo) : 'server repo';
  const context = file ? `${repoName} / ${basename(file)}` : repoName;

  const toolbar = (
    <>
      <label className="git-control">
        <span>Repo</span>
        <input
          type="text"
          value={repoInput}
          placeholder="(server working dir)"
          onChange={e => setRepoInput(e.target.value)}
          onBlur={applyRepo}
          onKeyDown={e => e.key === 'Enter' && applyRepo()}
        />
      </label>
      <label className="git-control">
        <span>File</span>
        <FilePicker files={pickerFiles} value={file} onChange={setFile} changed={changed} />
      </label>
      <label className="git-control">
        <span>Base</span>
        <select value={baseRef} onChange={e => setBaseRef(e.target.value)}>
          {baseOptions.map(ref => (
            <option key={ref} value={ref}>
              {refLabel(ref, commits)}
            </option>
          ))}
        </select>
      </label>
      <label className="git-control">
        <span>Target</span>
        <select value={targetRef} onChange={e => setTargetRef(e.target.value)}>
          {targetOptions.map(ref => (
            <option key={ref} value={ref}>
              {refLabel(ref, commits)}
            </option>
          ))}
        </select>
      </label>
      {loading && <span className="toolbar__filename">Loading…</span>}
      {errors.general && <span className="toolbar__error">{errors.general}</span>}
      {errors.base && <span className="toolbar__error">Base: {errors.base}</span>}
      {errors.target && <span className="toolbar__error">Target: {errors.target}</span>}
      {notes.base && <span className="toolbar__message">Base: {notes.base}</span>}
      {notes.target && <span className="toolbar__message">Target: {notes.target}</span>}
    </>
  );

  return (
    <DualProcessDiff
      left={left}
      right={right}
      leftLabel={`${context} — ${refLabel(baseRef, commits)}`}
      rightLabel={`${context} — ${refLabel(targetRef, commits)}`}
      toolbar={toolbar}
    />
  );
}
