// Abstraction over a source of git history for process files. The v1 implementation
// (HttpGitProvider) talks to the dev-server middleware in vite-plugin-git.ts. A future
// browser-only implementation (e.g. isomorphic-git) can satisfy the same interface so the
// views work unchanged in a static build.

export interface GitCommit {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  date: string;
}

/** A special ref meaning "the current working-tree contents on disk". */
export const WORKING_TREE = 'WORKING' as const;
export type GitRef = typeof WORKING_TREE | string;

export type ChangeStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed';

export interface ChangedFile {
  path: string;
  status: ChangeStatus;
}

export interface GitProvider {
  /** Repo-relative paths of tracked *.p.json files. */
  listFiles(): Promise<string[]>;
  /** Commits that touched the given file, newest first. */
  listCommits(file: string): Promise<GitCommit[]>;
  /** File contents at a given ref (or the working tree), or null if absent at that ref. */
  readAtRef(file: string, ref: GitRef): Promise<string | null>;
  hasUnstagedChanges(file: string): Promise<boolean>;
  /** Repo-relative *.p.json paths with local (working-tree) changes. */
  listChangedFiles(): Promise<ChangedFile[]>;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : `Request failed (${res.status})`);
  }
  return body as T;
}

export class HttpGitProvider implements GitProvider {
  private readonly baseUrl: string;
  private readonly repo?: string;

  constructor(options: { baseUrl?: string; repo?: string } = {}) {
    this.baseUrl = options.baseUrl ?? '/api/git';
    this.repo = options.repo;
  }

  private url(path: string, params: Record<string, string> = {}): string {
    const search = new URLSearchParams(params);
    if (this.repo) search.set('repo', this.repo);
    const query = search.toString();
    return query ? `${this.baseUrl}${path}?${query}` : `${this.baseUrl}${path}`;
  }

  async listFiles(): Promise<string[]> {
    const { files } = await getJson<{ files: string[] }>(this.url('/files'));
    return files;
  }

  async listCommits(file: string): Promise<GitCommit[]> {
    const { commits } = await getJson<{ commits: GitCommit[] }>(this.url('/log', { file }));
    return commits;
  }

  async readAtRef(file: string, ref: GitRef): Promise<string | null> {
    const url =
      ref === WORKING_TREE ? this.url('/working', { file }) : this.url('/show', { ref, file });
    const { content } = await getJson<{ content: string | null }>(url);
    return content;
  }

  async hasUnstagedChanges(file: string): Promise<boolean> {
    const { hasUnstagedChanges } = await getJson<{ hasUnstagedChanges: boolean }>(
      this.url('/status', { file })
    );
    return hasUnstagedChanges;
  }

  async listChangedFiles(): Promise<ChangedFile[]> {
    const { changes } = await getJson<{ changes: ChangedFile[] }>(this.url('/changes'));
    return changes;
  }
}
