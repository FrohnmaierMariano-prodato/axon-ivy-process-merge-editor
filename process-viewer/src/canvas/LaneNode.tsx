import type { NodeProps } from '@xyflow/react';
import './LaneNode.css';

export interface LaneNodeData extends Record<string, unknown> {
  label?: string;
  /** `pool` = outer swimlane container (thicker border); `lane` = a horizontal band inside it. */
  variant: 'pool' | 'lane';
}

/**
 * Renders a pool/lane background band (from a `.p.json` file's `layout.lanes`). Purely
 * decorative - not selectable/draggable and ignores pointer events so clicks pass through to the
 * canvas/elements above it.
 */
export function LaneNode({ data }: NodeProps & { data: LaneNodeData }) {
  return (
    <div className={`lane-node lane-node--${data.variant}`}>
      {data.label && <div className="lane-node__label">{data.label}</div>}
    </div>
  );
}
