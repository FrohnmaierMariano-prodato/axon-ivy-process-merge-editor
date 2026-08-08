import type { ReactNode } from 'react';
import type { ProcessElement } from '../model/schema-types';
import type { ElementDiffEntry } from '../diff/types';
import { STATUS_STYLE } from '../canvas/statusColors';

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

interface ParamLike {
  name?: string;
  type?: string;
  desc?: string;
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
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="detail-section" open>
      <summary className="detail-section__title">{title}</summary>
      <div className="detail-section__body">{children}</div>
    </details>
  );
}

export function DetailPanel({ element, diffEntry }: DetailPanelProps) {
  if (!element) {
    return (
      <div className="detail-panel detail-panel--empty">
        <p>Select an element to inspect its configuration.</p>
      </div>
    );
  }

  const status = diffEntry?.status;
  const description = element.visual?.description;
  const configEntries = Object.entries(element.config ?? {});

  return (
    <div className="detail-panel">
      <h3>{elementLabel(element)}</h3>

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

      {diffEntry?.changedPaths && diffEntry.changedPaths.length > 0 && (
        <Section title="Changed config paths">
          <ul className="detail-panel__changed-paths">
            {diffEntry.changedPaths.map(path => (
              <li key={path}>{path}</li>
            ))}
          </ul>
        </Section>
      )}

      {configEntries.map(([key, value]) => (
        <Section key={key} title={humanizeKey(key)}>
          <ConfigValue value={value} />
        </Section>
      ))}

      {configEntries.length === 0 && <p className="detail-panel__empty-note">No configuration on this element.</p>}

      <details className="detail-section">
        <summary className="detail-section__title">Raw config (JSON)</summary>
        <div className="detail-section__body">
          <pre className="detail-panel__json">{JSON.stringify(element.config ?? {}, null, 2)}</pre>
        </div>
      </details>
    </div>
  );
}
