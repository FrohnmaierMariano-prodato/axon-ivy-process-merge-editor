import { useCallback, useEffect, useMemo, useState } from 'react';
import { DualProcessDiff, type JumpResult } from './DualProcessDiff';
import { FilePicker } from './FilePicker';
import { adjacentFile } from './fileNavigation';
import { parseProcessText, ProcessParseError } from '../model/parseProcess';
import { resolveProcessPath } from '../model/processRegistry';
import {
  CONFLICT_OURS,
  CONFLICT_THEIRS,
  HttpGitProvider,
  WORKING_TREE,
  type ChangeStatus,
  type GitCommit,
  type GitRef
} from '../git/gitProvider';
import type { ProcessDocument } from '../model/schema-types';

const HEAD_REF = 'HEAD';

function refLabel(ref: GitRef, commits: GitCommit[]): string {
  if (ref === WORKING_TREE) return 'Working tree (uncommitted)';
  if (ref === CONFLICT_OURS) return 'Ours (local before merge)';
  if (ref === CONFLICT_THEIRS) return 'Theirs (incoming)';
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
  const isConflicted = changed.get(file) === 'conflicted';

  const selectFile = useCallback((nextFile: string) => {
    setFile(nextFile);
    if (changed.get(nextFile) === 'conflicted') {
      setBaseRef(CONFLICT_OURS);
      setTargetRef(CONFLICT_THEIRS);
    } else {
      setBaseRef(current => current === CONFLICT_OURS || current === CONFLICT_THEIRS ? HEAD_REF : current);
      setTargetRef(current => current === CONFLICT_OURS || current === CONFLICT_THEIRS ? WORKING_TREE : current);
    }
  }, [changed]);

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

  useEffect(() => {
    if (isConflicted) {
      setBaseRef(CONFLICT_OURS);
      setTargetRef(CONFLICT_THEIRS);
    } else {
      setBaseRef(current => current === CONFLICT_OURS || current === CONFLICT_THEIRS ? HEAD_REF : current);
      setTargetRef(current => current === CONFLICT_OURS || current === CONFLICT_THEIRS ? WORKING_TREE : current);
    }
  }, [file, isConflicted]);

  // Untracked *.p.json aren't returned by listFiles; surface them in the picker too.
  const pickerFiles = useMemo(() => {
    const set = new Set(files);
    for (const path of changed.keys()) set.add(path);
    return [...set];
  }, [files, changed]);
  const changedFiles = useMemo(
    () => pickerFiles.filter(path => changed.has(path)),
    [pickerFiles, changed]
  );
  const conflictedFiles = useMemo(
    () => pickerFiles.filter(path => changed.get(path) === 'conflicted'),
    [pickerFiles, changed]
  );
  const changeIndex = changedFiles.indexOf(file);
  const conflictIndex = conflictedFiles.indexOf(file);
  const previousChange = adjacentFile(changedFiles, file, -1);
  const nextChange = adjacentFile(changedFiles, file, 1);
  const previousConflict = adjacentFile(conflictedFiles, file, -1);
  const nextConflict = adjacentFile(conflictedFiles, file, 1);

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
    async (ref: GitRef, side: 'base' | 'target', isCurrent: () => boolean) => {
      try {
        const text = await provider.readAtRef(file, ref);
        const parsed = text === null ? EMPTY_DOCUMENT : parseProcessText(text);
        if (!isCurrent()) return;
        if (side === 'base') setLeft(parsed);
        else setRight(parsed);
        setErrors(prev => ({ ...prev, [side]: undefined }));
        setNotes(prev => ({ ...prev, [side]: text === null ? 'file not present at this version' : undefined }));
      } catch (e) {
        if (!isCurrent()) return;
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
    const isCurrent = () => !cancelled;
    Promise.all([loadSide(baseRef, 'base', isCurrent), loadSide(targetRef, 'target', isCurrent)]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [file, baseRef, targetRef, loadSide]);

  const baseOptions = useMemo<GitRef[]>(
    () => [
      ...(isConflicted ? [CONFLICT_OURS, CONFLICT_THEIRS] : []),
      HEAD_REF,
      ...commits.map(c => c.hash)
    ],
    [commits, isConflicted]
  );
  const targetOptions = useMemo<GitRef[]>(
    () => [
      ...(isConflicted ? [CONFLICT_THEIRS, CONFLICT_OURS] : []),
      WORKING_TREE,
      HEAD_REF,
      ...commits.map(c => c.hash)
    ],
    [commits, isConflicted]
  );

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

  // Load a referenced process (SubProcessCall/TriggerCall/DialogCall target) at the same
  // base/target refs, so "J" opens its diff just like drilling into the current file's changes.
  const resolveJump = useCallback(
    async (reference: string): Promise<JumpResult> => {
      const path = resolveProcessPath(reference, pickerFiles);
      if (!path) return { note: `No process file matching "${reference}" found in this repo.` };
      try {
        const [baseText, targetText] = await Promise.all([
          provider.readAtRef(path, baseRef),
          provider.readAtRef(path, targetRef)
        ]);
        const jumpLeft = baseText === null ? EMPTY_DOCUMENT : parseProcessText(baseText);
        const jumpRight = targetText === null ? EMPTY_DOCUMENT : parseProcessText(targetText);
        const jumpContext = `${repoName} / ${basename(path)}`;
        return {
          frame: {
            left: jumpLeft,
            right: jumpRight,
            leftLabel: `${jumpContext} — ${refLabel(baseRef, commits)}`,
            rightLabel: `${jumpContext} — ${refLabel(targetRef, commits)}`,
            crumb: basename(path)
          }
        };
      } catch (e) {
        const message = e instanceof ProcessParseError ? e.message : (e as Error).message;
        return { note: `Cannot open "${path}": ${message}` };
      }
    },
    [pickerFiles, provider, baseRef, targetRef, commits, repoName]
  );

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
        <FilePicker files={pickerFiles} value={file} onChange={selectFile} changed={changed} />
      </label>
      <div className="file-nav" aria-label="Changed file navigation">
        <button
          type="button"
          className="file-nav__button"
          disabled={!previousChange}
          onClick={() => previousChange && selectFile(previousChange)}
          title={previousChange ? `Previous change: ${basename(previousChange)}` : 'No changed files'}
        >
          <span aria-hidden>‹</span> Prev change
        </button>
        <span className="file-nav__count" aria-live="polite">
          {changeIndex + 1} / {changedFiles.length}
        </span>
        <button
          type="button"
          className="file-nav__button"
          disabled={!nextChange}
          onClick={() => nextChange && selectFile(nextChange)}
          title={nextChange ? `Next change: ${basename(nextChange)}` : 'No changed files'}
        >
          Next change <span aria-hidden>›</span>
        </button>
      </div>
      {conflictedFiles.length > 0 && (
        <div className="file-nav" aria-label="Merge conflict navigation">
          <button
            type="button"
            className="file-nav__button file-nav__button--conflict"
            onClick={() => previousConflict && selectFile(previousConflict)}
            title={`Previous conflict: ${basename(previousConflict ?? '')}`}
          >
            <span aria-hidden>‹</span> Prev conflict
          </button>
          <span className="file-nav__count file-nav__count--conflict" aria-live="polite">
            {conflictIndex + 1} / {conflictedFiles.length}
          </span>
          <button
            type="button"
            className="file-nav__button file-nav__button--conflict"
            onClick={() => nextConflict && selectFile(nextConflict)}
            title={`Next conflict: ${basename(nextConflict ?? '')}`}
          >
            Next conflict <span aria-hidden>›</span>
          </button>
        </div>
      )}
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
      rootLabel={file ? basename(file) : repoName}
      toolbar={toolbar}
      resolveJump={resolveJump}
    />
  );
}
