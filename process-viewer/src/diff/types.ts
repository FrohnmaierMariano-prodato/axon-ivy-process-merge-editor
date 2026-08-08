export type DiffStatus = 'added' | 'removed' | 'modified' | 'moved' | 'unchanged';

export interface ElementDiffEntry {
  id: string;
  status: DiffStatus;
  /** Present when the element exists on the left/base side. */
  left?: unknown;
  /** Present when the element exists on the right/other side. */
  right?: unknown;
  /** Dot-path list of changed config keys, only set when status === 'modified'. */
  changedPaths?: string[];
}

export interface ConnectorDiffEntry {
  id: string;
  ownerId: string;
  status: DiffStatus;
}

export interface ProcessDiffResult {
  elements: Map<string, ElementDiffEntry>;
  connectors: Map<string, ConnectorDiffEntry>;
}
