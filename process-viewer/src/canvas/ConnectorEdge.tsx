import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import type { DiffStatus } from '../diff/types';
import { STATUS_STYLE } from './statusColors';
import type { VisualPoint } from '../model/schema-types';

export interface ConnectorEdgeData extends Record<string, unknown> {
  /** Fully orthogonal path, pre-computed in `layout.ts` (source anchor, any bends, target anchor). */
  points: VisualPoint[];
  label?: string;
  status: DiffStatus;
}

function pathThroughPoints(points: VisualPoint[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

export function ConnectorEdge({ sourceX, sourceY, targetX, targetY, data, markerEnd }: EdgeProps & { data: ConnectorEdgeData }) {
  const status = data?.status ?? 'unchanged';
  const style = STATUS_STYLE[status];
  const points = data?.points && data.points.length > 0 ? data.points : [{ x: sourceX, y: sourceY }, { x: targetX, y: targetY }];

  const path = pathThroughPoints(points);
  const mid = points[Math.floor(points.length / 2)];
  const labelX = mid?.x ?? (sourceX + targetX) / 2;
  const labelY = mid?.y ?? (sourceY + targetY) / 2;

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: style.stroke,
          strokeWidth: status === 'unchanged' ? 1.5 : 2.5,
          strokeDasharray: style.dashed ? '5 4' : undefined
        }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: '#ffffffee',
              padding: '1px 5px',
              borderRadius: 4,
              fontSize: 10,
              color: style.stroke,
              border: `1px solid ${style.stroke}`,
              pointerEvents: 'none'
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
