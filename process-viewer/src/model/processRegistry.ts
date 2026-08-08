import type { ProcessDocument } from './schema-types';

export interface RegisteredProcess {
  /** Relative path (e.g. from a folder open, using '/' separators) or just the file name for a single-file open. */
  path: string;
  doc: ProcessDocument;
}

/** "financial/tracker/part3/exampleSub.p.json" -> "financial.tracker.part3.exampleSub" */
function pathToQualifiedName(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\.?\/+/, '')
    .replace(/\.p\.json$/i, '')
    .replace(/\.json$/i, '')
    .split('/')
    .filter(Boolean)
    .join('.');
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
    const wantedSegments = reference
      .replace(/\.p$/i, '')
      .split('.')
      .filter(Boolean);
    if (wantedSegments.length === 0) return undefined;

    let best: RegisteredProcess | undefined;
    let bestScore = 0;
    for (const entry of this.entries.values()) {
      const candidateSegments = pathToQualifiedName(entry.path).split('.').filter(Boolean);
      const score = suffixMatchLength(candidateSegments, wantedSegments);
      if (score > 0 && score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
    return best;
  }
}
