import { spawn } from 'node:child_process';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Dev-only middleware exposing read-only git operations for the "Git diff view".
// It shells out to the real `git` CLI. Everything is sandboxed to the repository
// root; requests for files outside the repo or with malformed refs are rejected.

const REF_PATTERN = /^[0-9a-zA-Z._/\-^~]+$/;
const ALLOWED_FILE = /\.(p\.json|json)$/i;

interface GitResult {
  stdout: string;
  stderr: string;
  code: number;
}

function runGit(args: string[], cwd: string): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    // No shell: args are passed as an array, so user input can't be interpreted as a command.
    const child = spawn('git', args, { cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => (stdout += chunk));
    child.stderr.on('data', chunk => (stderr += chunk));
    child.on('error', reject);
    child.on('close', code => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

async function resolveRepoRoot(startDir: string): Promise<string | undefined> {
  const result = await runGit(['rev-parse', '--show-toplevel'], startDir);
  if (result.code !== 0) return undefined;
  return result.stdout.trim();
}

/**
 * Optional allow-list of repo roots (read-only) via PROCESS_VIEWER_REPO_ROOTS
 * (comma/semicolon separated). Empty => any local repo is allowed.
 */
function parseAllowedRoots(): string[] {
  const raw = process.env.PROCESS_VIEWER_REPO_ROOTS;
  if (!raw) return [];
  return raw
    .split(/[;,]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(p => path.resolve(p));
}

function isWithinAllowed(root: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  return allowed.some(base => {
    const rel = path.relative(base, root);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  });
}

/** Returns the repo-relative POSIX path if `file` is a safe, allowed file inside `root`, else undefined. */
export function safeRelativePath(root: string, file: string): string | undefined {
  if (!file || !ALLOWED_FILE.test(file)) return undefined;
  const resolved = path.resolve(root, file);
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return undefined;
  return rel.split(path.sep).join('/');
}

export type ChangeStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed';

export interface ChangedFile {
  path: string;
  status: ChangeStatus;
}

// Git may quote paths containing special chars ("path\twith\ttab"); unquote conservatively.
function unquotePath(p: string): string {
  if (p.length >= 2 && p.startsWith('"') && p.endsWith('"')) {
    return p
      .slice(1, -1)
      .replace(/\\t/g, '\t')
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  return p;
}

function classifyStatus(code: string): ChangeStatus {
  if (code.includes('?')) return 'untracked';
  if (code.includes('R')) return 'renamed';
  if (code.includes('D')) return 'deleted';
  if (code.includes('A')) return 'added';
  return 'modified';
}

/** Parses `git status --porcelain` output into changed `*.p.json` files with a coarse status. */
export function parseStatusPorcelain(stdout: string): ChangedFile[] {
  const changes: ChangedFile[] = [];
  for (const line of stdout.split('\n')) {
    if (line.length < 4) continue;
    const code = line.slice(0, 2);
    let rest = line.slice(3);
    // Renames/copies are reported as "old -> new"; the current path is on the right.
    const arrow = rest.indexOf(' -> ');
    if (arrow >= 0) rest = rest.slice(arrow + 4);
    const filePath = unquotePath(rest.trim());
    if (!filePath || !ALLOWED_FILE.test(filePath)) continue;
    changes.push({ path: filePath, status: classifyStatus(code) });
  }
  return changes;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

function getQuery(req: IncomingMessage): URLSearchParams {
  const url = new URL(req.url ?? '', 'http://localhost');
  return url.searchParams;
}

async function handleFiles(res: ServerResponse, root: string): Promise<void> {
  const result = await runGit(['ls-files', '*.p.json'], root);
  if (result.code !== 0) {
    sendJson(res, 500, { error: result.stderr.trim() || 'git ls-files failed' });
    return;
  }
  const files = result.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  sendJson(res, 200, { files });
}

async function handleLog(res: ServerResponse, root: string, file: string): Promise<void> {
  const rel = safeRelativePath(root, file);
  if (!rel) {
    sendJson(res, 400, { error: 'Invalid or disallowed file path' });
    return;
  }
  // Record separator \x1f between fields, \x1e between commits — avoids collisions with commit text.
  const format = ['%H', '%h', '%s', '%an', '%aI'].join('%x1f') + '%x1e';
  const result = await runGit(['log', `--format=${format}`, '--', rel], root);
  if (result.code !== 0) {
    sendJson(res, 500, { error: result.stderr.trim() || 'git log failed' });
    return;
  }
  const commits = result.stdout
    .split('\x1e')
    .map(entry => entry.replace(/^\n/, '').trim())
    .filter(Boolean)
    .map(entry => {
      const [hash, shortHash, subject, author, date] = entry.split('\x1f');
      return { hash, shortHash, subject, author, date };
    });
  sendJson(res, 200, { commits });
}

async function handleShow(res: ServerResponse, root: string, ref: string, file: string): Promise<void> {
  const rel = safeRelativePath(root, file);
  if (!rel) {
    sendJson(res, 400, { error: 'Invalid or disallowed file path' });
    return;
  }
  if (!ref || !REF_PATTERN.test(ref)) {
    sendJson(res, 400, { error: 'Invalid ref' });
    return;
  }
  const result = await runGit(['show', `${ref}:${rel}`], root);
  if (result.code !== 0) {
    const stderr = result.stderr.trim();
    // File not present at this ref (new/untracked or added later) — report as absent, not an error.
    if (/does not exist in|exists on disk, but not in/i.test(stderr)) {
      sendJson(res, 200, { content: null, absent: true });
      return;
    }
    sendJson(res, 404, { error: stderr || 'git show failed' });
    return;
  }
  sendJson(res, 200, { content: result.stdout });
}

async function handleWorking(res: ServerResponse, root: string, file: string): Promise<void> {
  const rel = safeRelativePath(root, file);
  if (!rel) {
    sendJson(res, 400, { error: 'Invalid or disallowed file path' });
    return;
  }
  try {
    const content = await readFile(path.resolve(root, rel), 'utf8');
    sendJson(res, 200, { content });
  } catch (e) {
    // File missing on disk (e.g. deleted in the working tree) — report as absent, not an error.
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      sendJson(res, 200, { content: null, absent: true });
      return;
    }
    sendJson(res, 404, { error: `Cannot read working file: ${(e as Error).message}` });
  }
}

async function handleStatus(res: ServerResponse, root: string, file: string): Promise<void> {
  const rel = safeRelativePath(root, file);
  if (!rel) {
    sendJson(res, 400, { error: 'Invalid or disallowed file path' });
    return;
  }
  const result = await runGit(['status', '--porcelain', '--', rel], root);
  if (result.code !== 0) {
    sendJson(res, 500, { error: result.stderr.trim() || 'git status failed' });
    return;
  }
  sendJson(res, 200, { hasUnstagedChanges: result.stdout.trim().length > 0 });
}

async function handleChanges(res: ServerResponse, root: string): Promise<void> {
  // -uall lists individual untracked files (not just their parent dir) so new *.p.json show up.
  // The `*.p.json` pathspec (git-globbed, matches at any depth) keeps this in sync with /files.
  const result = await runGit(['status', '--porcelain', '-uall', '--', '*.p.json'], root);
  if (result.code !== 0) {
    sendJson(res, 500, { error: result.stderr.trim() || 'git status failed' });
    return;
  }
  sendJson(res, 200, { changes: parseStatusPorcelain(result.stdout) });
}

export function gitApiPlugin(): Plugin {
  return {
    name: 'process-viewer-git-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      const allowedRoots = parseAllowedRoots();
      server.middlewares.use('/api/git', (req, res, next) => {
        void (async () => {
          try {
            const url = new URL(req.url ?? '', 'http://localhost');
            const query = getQuery(req);
            const repoParam = query.get('repo');
            const startDir = repoParam ? path.resolve(repoParam) : server.config.root;
            const root = await resolveRepoRoot(startDir);
            if (!root) {
              sendJson(res as ServerResponse, 400, {
                error: repoParam ? `Not a git repository: ${repoParam}` : 'Not inside a git repository'
              });
              return;
            }
            if (!isWithinAllowed(root, allowedRoots)) {
              sendJson(res as ServerResponse, 403, { error: `Repository not allowed: ${root}` });
              return;
            }
            const file = query.get('file') ?? '';
            switch (url.pathname) {
              case '/files':
                await handleFiles(res as ServerResponse, root);
                return;
              case '/log':
                await handleLog(res as ServerResponse, root, file);
                return;
              case '/show':
                await handleShow(res as ServerResponse, root, query.get('ref') ?? '', file);
                return;
              case '/working':
                await handleWorking(res as ServerResponse, root, file);
                return;
              case '/status':
                await handleStatus(res as ServerResponse, root, file);
                return;
              case '/changes':
                await handleChanges(res as ServerResponse, root);
                return;
              default:
                next();
            }
          } catch (e) {
            sendJson(res as ServerResponse, 500, { error: (e as Error).message });
          }
        })();
      });
    }
  };
}
