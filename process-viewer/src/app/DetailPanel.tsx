import { useMemo, type ReactNode } from 'react';
import type { ProcessElement } from '../model/schema-types';
import type { ElementDiffEntry } from '../diff/types';
import { STATUS_STYLE } from '../canvas/statusColors';
import { deepEqual } from '../diff/deepEqual';
import {
  buildMapDiffTree,
  diffCodeLines,
  diffParams,
  groupChangedPathsBySection,
  mapNodeStatus,
  unionKeys,
  type MapDiffNode,
  type ParamLike
} from '../diff/configDiff';

export interface DetailPanelProps {
  element?: ProcessElement;
  diffEntry?: ElementDiffEntry;
}

function elementLabel(element: ProcessElement): string {
  if (Array.isArray(element.name)) return element.name.join(' / ');
  return element.name || element.type;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** "processCall" -> "Process Call", "errorCode" -> "Error Code". */
function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

interface MapNode {
  path: string;
  label: string;
  value?: string;
  children: MapNode[];
}

function buildMapTree(map: Record<string, string>): MapNode[] {
  const roots: MapNode[] = [];
  const byPath = new Map<string, MapNode>();
  for (const [key, value] of Object.entries(map)) {
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
      if (i === parts.length - 1) node.value = value;
      siblings = node.children;
    }
  }
  return roots;
}

function MapRow({ node, depth }: { node: MapNode; depth: number }) {
  return (
    <>
      <tr>
        <td style={{ paddingLeft: 8 + depth * 14 }}>{node.label}</td>
        <td className={node.value ? undefined : 'detail-table__placeholder'}>{node.value ?? ''}</td>
      </tr>
      {node.children.map(child => (
        <MapRow key={child.path} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

/** Renders a Designer-style "Attribute | Expression" mapping table, tree-indented for dotted paths (e.g. `out.audioFile`). */
function MappingTable({ map }: { map: Record<string, unknown> }) {
  const stringEntries = Object.entries(map).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  if (stringEntries.length === 0) return null;
  const tree = buildMapTree(Object.fromEntries(stringEntries));
  return (
    <table className="detail-table">
      <thead>
        <tr>
          <th>Attribute</th>
          <th>Expression</th>
        </tr>
      </thead>
      <tbody>
        {tree.map(node => (
          <MapRow key={node.path} node={node} depth={0} />
        ))}
      </tbody>
    </table>
  );
}

function CodeBlock({ code }: { code: string | string[] }) {
  const text = Array.isArray(code) ? code.join('\n') : code;
  if (!text) return null;
  return <pre className="detail-code">{text}</pre>;
}

function ParamsTable({ params }: { params: ParamLike[] }) {
  if (params.length === 0) return null;
  return (
    <table className="detail-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {params.map((p, i) => (
          <tr key={i}>
            <td>{p.name}</td>
            <td className="detail-table__type">{p.type}</td>
            <td>{p.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Recursively renders any config value; recognizes the common `map`/`code`/`params` shapes specially. */
function ConfigValue({ value }: { value: unknown }): ReactNode {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <span className="detail-scalar">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.every(v => typeof v === 'string')) {
      return <CodeBlock code={value} />;
    }
    if (value.every(isRecord)) {
      return (
        <div className="detail-config-tree">
          {value.map((item, i) => (
            <div className="detail-config-tree__row" key={i}>
              <ConfigObject obj={item} />
            </div>
          ))}
        </div>
      );
    }
    return <span className="detail-scalar">{JSON.stringify(value)}</span>;
  }
  if (isRecord(value)) return <ConfigObject obj={value} />;
  return <span className="detail-scalar">{JSON.stringify(value)}</span>;
}

function ConfigObject({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return (
    <div className="detail-config-tree">
      {entries.map(([key, val]) => {
        if (key === 'map' && isRecord(val)) {
          return (
            <div className="detail-config-tree__row detail-config-tree__row--full" key={key}>
              <MappingTable map={val} />
            </div>
          );
        }
        if (key === 'code' && (typeof val === 'string' || Array.isArray(val))) {
          return (
            <div className="detail-config-tree__row detail-config-tree__row--full" key={key}>
              <CodeBlock code={val as string | string[]} />
            </div>
          );
        }
        if (key === 'params' && Array.isArray(val)) {
          return (
            <div className="detail-config-tree__row detail-config-tree__row--full" key={key}>
              <ParamsTable params={val as ParamLike[]} />
            </div>
          );
        }
        return (
          <div className="detail-config-tree__row" key={key}>
            <span className="detail-config-tree__key">{humanizeKey(key)}</span>
            <div className="detail-config-tree__value">
              <ConfigValue value={val} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One always-expanded (but collapsible) accordion section, mirroring Designer's General/Dialog/Output tabs - shown all-at-once instead of one-at-a-time. */
function Section({ title, changeCount, children }: { title: string; changeCount?: number; children: ReactNode }) {
  return (
    <details className="detail-section" open>
      <summary className="detail-section__title">
        <span>{title}</span>
        {!!changeCount && <span className="detail-section__badge">{changeCount === 1 ? '1 change' : `${changeCount} changes`}</span>}
      </summary>
      <div className="detail-section__body">{children}</div>
    </details>
  );
}

function formatScalar(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(' / ');
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Stacked "old value above, new value below" inline diff, used for any changed scalar (and as the fallback for mismatched shapes). */
function DiffScalar({ left, right }: { left?: unknown; right?: unknown }) {
  const leftEmpty = left === undefined || left === null || left === '';
  const rightEmpty = right === undefined || right === null || right === '';
  return (
    <span className="detail-diff-scalar">
      {!leftEmpty && <span className="detail-diff-scalar__old">{formatScalar(left)}</span>}
      {!rightEmpty && <span className="detail-diff-scalar__new">{formatScalar(right)}</span>}
    </span>
  );
}

function DiffMapRow({ node, depth }: { node: MapDiffNode; depth: number }) {
  const status = mapNodeStatus(node);
  const hasValue = node.leftValue !== undefined || node.rightValue !== undefined;
  return (
    <>
      <tr className={status !== 'unchanged' ? `detail-table__row--${status}` : undefined}>
        <td style={{ paddingLeft: 8 + depth * 14 }}>{node.label}</td>
        <td className={hasValue ? undefined : 'detail-table__placeholder'}>
          {status === 'unchanged' ? (node.rightValue ?? node.leftValue ?? '') : <DiffScalar left={node.leftValue} right={node.rightValue} />}
        </td>
      </tr>
      {node.children.map(child => (
        <DiffMapRow key={child.path} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

/** Diff-aware `MappingTable`: unchanged rows render like normal, changed/added/removed rows show old-over-new highlighted in place. */
function DiffMappingTable({ left, right }: { left: Record<string, unknown>; right: Record<string, unknown> }) {
  const leftStr = Object.fromEntries(Object.entries(left).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  const rightStr = Object.fromEntries(Object.entries(right).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  if (Object.keys(leftStr).length === 0 && Object.keys(rightStr).length === 0) return null;
  const tree = buildMapDiffTree(leftStr, rightStr);
  return (
    <table className="detail-table">
      <thead>
        <tr>
          <th>Attribute</th>
          <th>Expression</th>
        </tr>
      </thead>
      <tbody>
        {tree.map(node => (
          <DiffMapRow key={node.path} node={node} depth={0} />
        ))}
      </tbody>
    </table>
  );
}

/** Diff-aware `ParamsTable`: rows matched by param name, added/removed/changed rows are tinted and show old -> new type/description. */
function DiffParamsTable({ left, right }: { left: ParamLike[]; right: ParamLike[] }) {
  const rows = diffParams(left, right);
  if (rows.length === 0) return null;
  return (
    <table className="detail-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.name} className={row.status !== 'unchanged' ? `detail-table__row--${row.status}` : undefined}>
            <td>{row.name}</td>
            <td className="detail-table__type">
              {row.status === 'changed' ? <DiffScalar left={row.left?.type} right={row.right?.type} /> : row.right?.type ?? row.left?.type}
            </td>
            <td>{row.status === 'changed' ? <DiffScalar left={row.left?.desc} right={row.right?.desc} /> : row.right?.desc ?? row.left?.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Diff-aware `CodeBlock`: renders a compact +/- line diff (LCS-based) instead of the plain snippet. */
function DiffCodeBlock({ left, right, className }: { left?: string | string[]; right?: string | string[]; className?: string }) {
  const lines = diffCodeLines(left, right);
  if (lines.length === 0) return null;
  return (
    <pre className={`detail-code detail-code-diff${className ? ` ${className}` : ''}`}>
      {lines.map((line, i) => (
        <div key={i} className={`detail-code-diff__line detail-code-diff__line--${line.status}`}>
          <span className="detail-code-diff__marker">{line.status === 'added' ? '+' : line.status === 'removed' ? '-' : '\u00a0'}</span>
          <span className="detail-code-diff__text">{line.text}</span>
        </div>
      ))}
    </pre>
  );
}

/** Diff-aware counterpart of `ConfigValue`: recurses in lock-step over both sides, only rendering inline old/new where a leaf actually differs. */
function ConfigValueDiff({ left, right }: { left: unknown; right: unknown }): ReactNode {
  const leftEmpty = left === undefined || left === null || left === '';
  const rightEmpty = right === undefined || right === null || right === '';
  if (leftEmpty && rightEmpty) return null;
  if (deepEqual(left ?? null, right ?? null)) return <ConfigValue value={right ?? left} />;

  if (isRecord(left) || isRecord(right)) {
    return <ConfigObjectDiff left={isRecord(left) ? left : {}} right={isRecord(right) ? right : {}} />;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    const la = Array.isArray(left) ? left : [];
    const ra = Array.isArray(right) ? right : [];
    if (la.every(v => typeof v === 'string') && ra.every(v => typeof v === 'string')) {
      return <DiffCodeBlock left={la as string[]} right={ra as string[]} />;
    }
    if (la.every(isRecord) && ra.every(isRecord)) {
      const length = Math.max(la.length, ra.length);
      return (
        <div className="detail-config-tree">
          {Array.from({ length }, (_, i) => (
            <div className="detail-config-tree__row detail-config-tree__row--full" key={i}>
              <ConfigValueDiff left={la[i]} right={ra[i]} />
            </div>
          ))}
        </div>
      );
    }
    return <DiffScalar left={la.length ? la : undefined} right={ra.length ? ra : undefined} />;
  }

  return <DiffScalar left={leftEmpty ? undefined : left} right={rightEmpty ? undefined : right} />;
}

/** Diff-aware counterpart of `ConfigObject`: unions both sides' keys and tints/expands only the rows that actually changed. */
function ConfigObjectDiff({ left, right }: { left: Record<string, unknown>; right: Record<string, unknown> }) {
  const keys = unionKeys(left, right).filter(key => {
    const l = left[key];
    const r = right[key];
    const lEmpty = l === undefined || l === null || l === '';
    const rEmpty = r === undefined || r === null || r === '';
    return !(lEmpty && rEmpty);
  });
  return (
    <div className="detail-config-tree">
      {keys.map(key => {
        const l = left[key];
        const r = right[key];
        if (key === 'map' && (isRecord(l) || isRecord(r))) {
          return (
            <div className="detail-config-tree__row detail-config-tree__row--full" key={key}>
              <DiffMappingTable left={isRecord(l) ? l : {}} right={isRecord(r) ? r : {}} />
            </div>
          );
        }
        if (key === 'code' && (typeof l === 'string' || Array.isArray(l) || typeof r === 'string' || Array.isArray(r))) {
          return (
            <div className="detail-config-tree__row detail-config-tree__row--full" key={key}>
              <DiffCodeBlock left={l as string | string[] | undefined} right={r as string | string[] | undefined} />
            </div>
          );
        }
        if (key === 'params' && (Array.isArray(l) || Array.isArray(r))) {
          return (
            <div className="detail-config-tree__row detail-config-tree__row--full" key={key}>
              <DiffParamsTable left={(l as ParamLike[]) ?? []} right={(r as ParamLike[]) ?? []} />
            </div>
          );
        }
        const equal = deepEqual(l ?? null, r ?? null);
        return (
          <div className={`detail-config-tree__row${equal ? '' : ' detail-config-tree__row--changed'}`} key={key}>
            <span className="detail-config-tree__key">{humanizeKey(key)}</span>
            <div className="detail-config-tree__value">{equal ? <ConfigValue value={r ?? l} /> : <ConfigValueDiff left={l} right={r} />}</div>
          </div>
        );
      })}
    </div>
  );
}

export function DetailPanel({ element, diffEntry }: DetailPanelProps) {
  const isDiffMode = diffEntry?.status === 'modified' && !!diffEntry.left && !!diffEntry.right;
  const leftEl = diffEntry?.left;
  const rightEl = diffEntry?.right;
  const sectionCounts = useMemo(() => groupChangedPathsBySection(diffEntry?.changedPaths ?? []), [diffEntry?.changedPaths]);

  if (!element) {
    return (
      <div className="detail-panel detail-panel--empty">
        <p>Select an element to inspect its configuration.</p>
      </div>
    );
  }

  const status = diffEntry?.status;
  const description = element.visual?.description;
  const leftConfig = leftEl?.config ?? {};
  const rightConfig = rightEl?.config ?? {};
  const configKeys = isDiffMode ? unionKeys(leftConfig, rightConfig) : Object.keys(element.config ?? {});
  const nameChanged = isDiffMode && JSON.stringify(leftEl!.name ?? '') !== JSON.stringify(rightEl!.name ?? '');
  const hasSummary = isDiffMode && (sectionCounts.size > 0 || nameChanged);

  return (
    <div className="detail-panel">
      <h3>{elementLabel(element)}</h3>

      {hasSummary && (
        <div className="detail-diff-summary">
          <span className="detail-diff-summary__label">Config changed in:</span>
          {nameChanged && <span className="detail-diff-summary__chip">Name</span>}
          {Array.from(sectionCounts.entries()).map(([section, count]) => (
            <span key={section} className="detail-diff-summary__chip">
              {humanizeKey(section)} ({count})
            </span>
          ))}
        </div>
      )}

      <Section title="General">
        <div className="detail-config-tree">
          <div className="detail-config-tree__row">
            <span className="detail-config-tree__key">Type</span>
            <div className="detail-config-tree__value">
              <span className="detail-scalar">{element.type}</span>
            </div>
          </div>
          <div className="detail-config-tree__row">
            <span className="detail-config-tree__key">Id</span>
            <div className="detail-config-tree__value">
              <span className="detail-scalar">{element.id}</span>
            </div>
          </div>
          {nameChanged && (
            <div className="detail-config-tree__row detail-config-tree__row--changed">
              <span className="detail-config-tree__key">Name</span>
              <div className="detail-config-tree__value">
                <DiffScalar left={leftEl!.name} right={rightEl!.name} />
              </div>
            </div>
          )}
          {description && (
            <div className="detail-config-tree__row">
              <span className="detail-config-tree__key">Description</span>
              <div className="detail-config-tree__value">
                <span className="detail-scalar">{description}</span>
              </div>
            </div>
          )}
          {status && (
            <div className="detail-config-tree__row">
              <span className="detail-config-tree__key">Diff status</span>
              <div className="detail-config-tree__value">
                <span className="status-badge" style={{ background: STATUS_STYLE[status].fill, color: STATUS_STYLE[status].stroke }}>
                  {status}
                </span>
              </div>
            </div>
          )}
        </div>
      </Section>

      {configKeys.map(key => {
        if (isDiffMode) {
          const l = leftConfig[key];
          const r = rightConfig[key];
          const equal = deepEqual(l ?? null, r ?? null);
          return (
            <Section key={key} title={humanizeKey(key)} changeCount={sectionCounts.get(key)}>
              {equal ? <ConfigValue value={r ?? l} /> : <ConfigValueDiff left={l} right={r} />}
            </Section>
          );
        }
        return (
          <Section key={key} title={humanizeKey(key)}>
            <ConfigValue value={element.config?.[key]} />
          </Section>
        );
      })}

      {configKeys.length === 0 && <p className="detail-panel__empty-note">No configuration on this element.</p>}

      <details className="detail-section">
        <summary className="detail-section__title">Raw config (JSON)</summary>
        <div className="detail-section__body">
          {isDiffMode ? (
            <DiffCodeBlock
              className="detail-panel__json-diff-code"
              left={JSON.stringify(leftConfig, null, 2)}
              right={JSON.stringify(rightConfig, null, 2)}
            />
          ) : (
            <pre className="detail-panel__json">{JSON.stringify(element.config ?? {}, null, 2)}</pre>
          )}
        </div>
      </details>
    </div>
  );
}

