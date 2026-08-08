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

export function DetailPanel({ element, diffEntry }: DetailPanelProps) {
  if (!element) {
    return (
      <div className="detail-panel detail-panel--empty">
        <p>Select an element to inspect its configuration.</p>
      </div>
    );
  }

  const status = diffEntry?.status;

  return (
    <div className="detail-panel">
      <h3>{elementLabel(element)}</h3>
      <dl className="detail-panel__meta">
        <dt>Type</dt>
        <dd>{element.type}</dd>
        <dt>Id</dt>
        <dd>{element.id}</dd>
        {status && (
          <>
            <dt>Diff status</dt>
            <dd>
              <span className="status-badge" style={{ background: STATUS_STYLE[status].fill, color: STATUS_STYLE[status].stroke }}>
                {status}
              </span>
            </dd>
          </>
        )}
      </dl>

      {diffEntry?.changedPaths && diffEntry.changedPaths.length > 0 && (
        <>
          <h4>Changed config paths</h4>
          <ul className="detail-panel__changed-paths">
            {diffEntry.changedPaths.map(path => (
              <li key={path}>{path}</li>
            ))}
          </ul>
        </>
      )}

      <h4>Config (this side)</h4>
      <pre className="detail-panel__json">{JSON.stringify(element.config ?? {}, null, 2)}</pre>
    </div>
  );
}
