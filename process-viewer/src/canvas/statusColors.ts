import type { DiffStatus } from '../diff/types';

export interface StatusStyle {
  stroke: string;
  fill: string;
  dashed?: boolean;
}

/** Visual treatment per diff status, used to color node/edge outlines in diff-view. */
export const STATUS_STYLE: Record<DiffStatus, StatusStyle> = {
  unchanged: { stroke: '#94a3b8', fill: '#ffffff' },
  added: { stroke: '#16a34a', fill: '#dcfce7' },
  removed: { stroke: '#dc2626', fill: '#fee2e2', dashed: true },
  modified: { stroke: '#d97706', fill: '#fef3c7' },
  moved: { stroke: '#2563eb', fill: '#dbeafe' }
};
