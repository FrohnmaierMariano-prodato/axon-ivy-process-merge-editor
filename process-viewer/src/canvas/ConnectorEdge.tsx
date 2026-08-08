import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import type { DiffStatus } from '../diff/types';
import { STATUS_STYLE } from './statusColors';
import type { VisualPoint } from '../model/schema-types';

export interface ConnectorEdgeData extends Record<string, unknown> {
  via?: VisualPoint[];
  label?: string;
  status: DiffStatus;
}

function pathThroughPoints(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

export function ConnectorEdge({ sourceX, sourceY, targetX, targetY, data, markerEnd }: EdgeProps & { data: ConnectorEdgeData }) {
  const status = data?.status ?? 'unchanged';
  const style = STATUS_STYLE[status];
  const via = data?.via ?? [];

  const [bezierPath, labelX, labelY] =
    via.length === 0
      ? getBezierPath({ sourceX, sourceY, targetX, targetY })
      : [pathThroughPoints([{ x: sourceX, y: sourceY }, ...via, { x: targetX, y: targetY }]), via[Math.floor(via.length / 2)]?.x ?? (sourceX + targetX) / 2, via[Math.floor(via.length / 2)]?.y ?? (sourceY + targetY) / 2];

  return (
    <>
      <BaseEdge
        path={bezierPath}
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
