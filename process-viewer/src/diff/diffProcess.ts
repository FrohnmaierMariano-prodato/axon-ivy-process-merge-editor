import { flattenElements } from '../model/parseProcess';
import type { Connector, ProcessDocument, ProcessElement } from '../model/schema-types';
import { deepEqual, diffPaths } from './deepEqual';
import type { ConnectorDiffEntry, ElementDiffEntry, ProcessDiffResult } from './types';

function positionsEqual(a: ProcessElement, b: ProcessElement): boolean {
  const pa = a.visual?.at;
  const pb = b.visual?.at;
  if (!pa || !pb) return true; // nothing to compare, don't flag as moved
  return pa.x === pb.x && pa.y === pb.y;
}

function diffElement(left: ProcessElement | undefined, right: ProcessElement | undefined): ElementDiffEntry {
  const id = (left ?? right)!.id;
  if (left && !right) return { id, status: 'removed', left };
  if (!left && right) return { id, status: 'added', right };
  if (!left || !right) throw new Error('unreachable');

  const contentEqual =
    left.type === right.type &&
    JSON.stringify(left.name ?? '') === JSON.stringify(right.name ?? '') &&
    deepEqual(left.config ?? {}, right.config ?? {});

  if (!contentEqual) {
    const changedPaths = diffPaths(left.config ?? {}, right.config ?? {});
    return { id, status: 'modified', left, right, changedPaths };
  }
  if (!positionsEqual(left, right)) {
    return { id, status: 'moved', left, right };
  }
  return { id, status: 'unchanged', left, right };
}

function connectorKey(ownerId: string, connector: Connector): string {
  return `${ownerId}::${connector.id}`;
}

function connectorContentEqual(a: Connector, b: Connector): boolean {
  return a.to === b.to && (a.condition ?? '') === (b.condition ?? '') && (a.color ?? '') === (b.color ?? '') && (a.label?.name ?? '') === (b.label?.name ?? '');
}

function connectorPositionEqual(a: Connector, b: Connector): boolean {
  return deepEqual(a.via ?? [], b.via ?? []);
}

function collectConnectors(elements: ProcessElement[]): Map<string, { ownerId: string; connector: Connector }> {
  const map = new Map<string, { ownerId: string; connector: Connector }>();
  for (const el of flattenElements(elements)) {
    for (const connector of el.connect ?? []) {
      map.set(connectorKey(el.id, connector), { ownerId: el.id, connector });
    }
  }
  return map;
}

/**
 * Compares two process documents and classifies every element and connector
 * (matched by `id`, recursively through nested/boundary elements) as
 * added / removed / modified / moved / unchanged.
 */
export function diffProcess(left: ProcessDocument, right: ProcessDocument): ProcessDiffResult {
  const leftElements = new Map(flattenElements(left.elements).map(el => [el.id, el]));
  const rightElements = new Map(flattenElements(right.elements).map(el => [el.id, el]));

  const elements = new Map<string, ElementDiffEntry>();
  const allIds = new Set([...leftElements.keys(), ...rightElements.keys()]);
  for (const id of allIds) {
    elements.set(id, diffElement(leftElements.get(id), rightElements.get(id)));
  }

  const leftConnectors = collectConnectors(left.elements);
  const rightConnectors = collectConnectors(right.elements);
  const connectors = new Map<string, ConnectorDiffEntry>();
  const allConnectorKeys = new Set([...leftConnectors.keys(), ...rightConnectors.keys()]);
  for (const key of allConnectorKeys) {
    const l = leftConnectors.get(key);
    const r = rightConnectors.get(key);
    const ownerId = (l ?? r)!.ownerId;
    const id = (l ?? r)!.connector.id;
    if (l && !r) {
      connectors.set(key, { id, ownerId, status: 'removed' });
    } else if (!l && r) {
      connectors.set(key, { id, ownerId, status: 'added' });
    } else if (l && r) {
      if (!connectorContentEqual(l.connector, r.connector)) {
        connectors.set(key, { id, ownerId, status: 'modified' });
      } else if (!connectorPositionEqual(l.connector, r.connector)) {
        connectors.set(key, { id, ownerId, status: 'moved' });
      } else {
        connectors.set(key, { id, ownerId, status: 'unchanged' });
      }
    }
  }

  return { elements, connectors };
}
