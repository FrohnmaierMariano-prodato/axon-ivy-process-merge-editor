/** Deep, key-order-independent equality check for plain JSON-like values. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(key => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
  }
  return false;
}

/**
 * Collects dot-notation paths (relative to `basePath`) where two JSON-like
 * values differ. Used to summarize *what* changed inside an element's config
 * for the diff detail panel.
 */
export function diffPaths(a: unknown, b: unknown, basePath = ''): string[] {
  if (deepEqual(a, b)) return [];

  const aIsObj = typeof a === 'object' && a !== null;
  const bIsObj = typeof b === 'object' && b !== null;

  if (!aIsObj || !bIsObj || Array.isArray(a) !== Array.isArray(b)) {
    return [basePath || '(root)'];
  }

  const aRec = a as Record<string, unknown>;
  const bRec = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(aRec), ...Object.keys(bRec)]);
  const paths: string[] = [];
  for (const key of keys) {
    const childPath = basePath ? `${basePath}.${key}` : key;
    paths.push(...diffPaths(aRec[key], bRec[key], childPath));
  }
  return paths;
}
