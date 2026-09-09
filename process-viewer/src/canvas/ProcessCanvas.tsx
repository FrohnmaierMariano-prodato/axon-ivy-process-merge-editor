import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, type NodeTypes, type EdgeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import type { ProcessDocument } from '../model/schema-types';
import type { ProcessDiffResult } from '../diff/types';
import { layoutProcess } from './layout';
import { ElementNode } from './ElementNode';
import { ConnectorEdge } from './ConnectorEdge';
import { LaneNode } from './LaneNode';
import { EdgeMarkerDefs } from './EdgeMarkerDefs';

const nodeTypes: NodeTypes = { processElement: ElementNode, lane: LaneNode };
const edgeTypes: EdgeTypes = { connector: ConnectorEdge };

// Passed as `style` (not just a CSS class) so MiniMap's internal viewBox/scale math - which reads
// `style.width`/`style.height` rather than the rendered box size - stays in sync with the actual size.
const MINIMAP_STYLE = { width: 110, height: 80 };

export interface ProcessCanvasProps {
  document: ProcessDocument;
  diff?: ProcessDiffResult;
  onSelectElement?: (elementId: string | undefined) => void;
}

export function ProcessCanvas({ document, diff, onSelectElement }: ProcessCanvasProps) {
  const { nodes, edges } = useMemo(() => layoutProcess(document, diff), [document, diff]);

  return (
    <ReactFlowProvider>
      <EdgeMarkerDefs />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => onSelectElement?.(node.id)}
        onPaneClick={() => onSelectElement?.(undefined)}
        minZoom={0.1}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
        <MiniMap className="process-minimap" style={MINIMAP_STYLE} pannable zoomable />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
