/**
 * Value-level diff helpers for rendering config changes inline in the detail
 * panel (as opposed to `diffPaths` in `deepEqual.ts`, which only reports
 * *where* something changed for the element-level status). These power the
 * "Mapping" table, "Code" block and "Params" table diff renderers, plus the
 * per-section change-count badges and the top summary strip.
 */

export type CellStatus = 'unchanged' | 'added' | 'removed' | 'changed';

export interface MapDiffNode {
  path: string;
  label: string;
  leftValue?: string;
  rightValue?: string;
  children: MapDiffNode[];
}

/** Builds a dot-path tree (like Designer's mapping tree) that carries both sides' values per leaf. */
export function buildMapDiffTree(left: Record<string, string>, right: Record<string, string>): MapDiffNode[] {
  const roots: MapDiffNode[] = [];
  const byPath = new Map<string, MapDiffNode>();
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const parts = key.split('.');
    let siblings = roots;
    let path = '';
    for (let i = 0; i < parts.length; i++) {
      path = path ? `${path}.${parts[i]}` : parts[i];
      let node = byPath.get(path);
      if (!node) {
        node = { path, label: parts[i], children: [] };
        byPath.set(path, node);
        siblings.push(node);
      }
      if (i === parts.length - 1) {
        node.leftValue = left[key];
        node.rightValue = right[key];
      }
      siblings = node.children;
    }
  }
  return roots;
}

/** Status of a single mapping-tree leaf, based on which side(s) hold a value. */
export function mapNodeStatus(node: MapDiffNode): CellStatus {
  const hasLeft = node.leftValue !== undefined;
  const hasRight = node.rightValue !== undefined;
  if (!hasLeft && !hasRight) return 'unchanged';
  if (hasLeft && !hasRight) return 'removed';
  if (!hasLeft && hasRight) return 'added';
  return node.leftValue === node.rightValue ? 'unchanged' : 'changed';
}

export interface ParamLike {
  name?: string;
  type?: string;
  desc?: string;
}

export interface ParamDiffRow {
  name: string;
  status: CellStatus;
  left?: ParamLike;
  right?: ParamLike;
}

/** Matches signature params by name (order-preserving, left-first) and classifies each row. */
export function diffParams(left: ParamLike[], right: ParamLike[]): ParamDiffRow[] {
  const byName = new Map<string, { left?: ParamLike; right?: ParamLike }>();
  const order: string[] = [];
  for (const p of left) {
    const name = p.name ?? '';
    if (!byName.has(name)) order.push(name);
    byName.set(name, { ...byName.get(name), left: p });
  }
  for (const p of right) {
    const name = p.name ?? '';
    if (!byName.has(name)) order.push(name);
    byName.set(name, { ...byName.get(name), right: p });
  }
  return order.map(name => {
    const { left: l, right: r } = byName.get(name)!;
    let status: CellStatus = 'unchanged';
    if (!l) status = 'added';
    else if (!r) status = 'removed';
    else if (l.type !== r.type || l.desc !== r.desc) status = 'changed';
    return { name, status, left: l, right: r };
  });
}

export type LineStatus = 'added' | 'removed' | 'unchanged';

export interface LineDiff {
  status: LineStatus;
  text: string;
}

function toLines(code: string | string[] | undefined): string[] {
  if (code === undefined) return [];
  return Array.isArray(code) ? code : code.split('\n');
}

/** Above this many (lines-left * lines-right) cells, skip the O(n*m) LCS and fall back to a whole-block diff. */
const MAX_LCS_CELLS = 200_000;

/** Line-level diff (classic LCS), used to render code/script snippets as a compact +/- diff. */
export function diffCodeLines(left: string | string[] | undefined, right: string | string[] | undefined): LineDiff[] {
  const a = toLines(left);
  const b = toLines(right);
  const n = a.length;
  const m = b.length;

  if (n * m > MAX_LCS_CELLS) {
    return [...a.map(text => ({ status: 'removed' as const, text })), ...b.map(text => ({ status: 'added' as const, text }))];
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: LineDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ status: 'unchanged', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ status: 'removed', text: a[i] });
      i++;
    } else {
      result.push({ status: 'added', text: b[j] });
      j++;
    }
  }
  while (i < n) result.push({ status: 'removed', text: a[i++] });
  while (j < m) result.push({ status: 'added', text: b[j++] });
  return result;
}

/** Union of two objects' keys, left-order-first then any new right-only keys appended. */
export function unionKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const key of Object.keys(a)) {
    if (!seen.has(key)) {
      seen.add(key);
      order.push(key);
    }
  }
  for (const key of Object.keys(b)) {
    if (!seen.has(key)) {
      seen.add(key);
      order.push(key);
    }
  }
  return order;
}

/** Groups flat dot-paths (from `diffPaths`) by their top-level config key, for section badges / summary chips. */
export function groupChangedPathsBySection(changedPaths: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const path of changedPaths) {
    const section = path.split('.')[0] || '(root)';
    map.set(section, (map.get(section) ?? 0) + 1);
  }
  return map;
}
