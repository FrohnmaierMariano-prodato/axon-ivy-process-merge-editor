import type { ProcessDocument } from './schema-types';

export interface RegisteredProcess {
  /** Relative path (e.g. from a folder open, using '/' separators) or just the file name for a single-file open. */
  path: string;
  doc: ProcessDocument;
}

/** "financial/tracker/part3/exampleSub.p.json" -> ["financial", "tracker", "part3", "exampleSub"] */
function pathToSegments(path: string): string[] {
  return path
    .replace(/\\/g, '/')
    .replace(/^\.?\/+/, '')
    .replace(/\.p\.json$/i, '')
    .replace(/\.json$/i, '')
    .split('/')
    .filter(Boolean);
}

/**
 * Splits a process reference into comparable segments. Real Axon Ivy references mix separators:
 * `SubProcessCall`/`TriggerCall` `processCall` uses slashes (`aps/internal/.../Statusupdates`),
 * while `DialogCall` `dialog` uses dots (`aps.internals.common.....Form`), so both are treated as separators.
 */
function referenceToSegments(reference: string): string[] {
  return reference
    .replace(/\\/g, '/')
    .replace(/\.p$/i, '')
    .split(/[./]/)
    .filter(Boolean);
}

/** Length of the shared suffix between two dot-segment arrays (0 = the last/most-specific segment already differs). */
function suffixMatchLength(a: string[], b: string[]): number {
  let i = a.length - 1;
  let j = b.length - 1;
  let count = 0;
  while (i >= 0 && j >= 0 && a[i].toLowerCase() === b[j].toLowerCase()) {
    count++;
    i--;
    j--;
  }
  return count;
}

/**
 * Extracts the process reference from a Designer-style call signature, e.g.
 * `"exampleSub:call(java.io.File)"` -> `"exampleSub"`, or
 * `"financial.tracker.part3.Transactions:start(String)"` -> `"financial.tracker.part3.Transactions"`.
 */
export function extractProcessReference(signature: string | undefined): string | undefined {
  if (!signature) return undefined;
  const idx = signature.indexOf(':');
  return idx >= 0 ? signature.slice(0, idx) : signature;
}

/**
 * Resolves a process reference against a flat list of candidate `.p.json` paths by comparing
 * segments from the right (most-specific first). Returns the best-matching path, or `undefined`
 * if nothing shares at least the final segment. Shared by the in-memory registry (single view)
 * and the git-backed views (which resolve against the repo's tracked file list).
 */
export function resolveProcessPath(reference: string, paths: Iterable<string>): string | undefined {
  const wantedSegments = referenceToSegments(reference);
  if (wantedSegments.length === 0) return undefined;

  let best: string | undefined;
  let bestScore = 0;
  for (const path of paths) {
    const segments = pathToSegments(path);
    let score = suffixMatchLength(segments, wantedSegments);
    // HTML dialogs live at `.../<Dialog>/<Dialog>Process.p.json` but are referenced as `...<Dialog>`,
    // so also try matching with the redundant trailing "...Process" file segment collapsed away.
    const last = segments.length - 1;
    if (last >= 1 && segments[last] === `${segments[last - 1]}Process`) {
      score = Math.max(score, suffixMatchLength(segments.slice(0, last), wantedSegments));
    }
    if (score > 0 && score > bestScore) {
      bestScore = score;
      best = path;
    }
  }
  return best;
}

/**
 * Keeps track of every `.p.json` file the user has opened so far (individually or via a
 * folder), so that `SubProcessCall` references (which point at a process by qualified name,
 * not a URL/path) can be resolved without needing arbitrary disk access. Matching is done by
 * comparing dot-separated path segments from the right (most-specific first), so a reference
 * like `financial.tracker.part3.exampleSub` matches a file at any nesting depth as long as its
 * path ends the same way (e.g. `.../financial/tracker/part3/exampleSub.p.json`), and a bare
 * reference like `exampleSub` still matches by file name alone.
 */
export class ProcessRegistry {
  private entries = new Map<string, RegisteredProcess>();

  register(path: string, doc: ProcessDocument): void {
    this.entries.set(path, { path, doc });
  }

  all(): RegisteredProcess[] {
    return Array.from(this.entries.values());
  }

  resolve(reference: string): RegisteredProcess | undefined {
    const path = resolveProcessPath(reference, this.entries.keys());
    return path ? this.entries.get(path) : undefined;
  }
}
