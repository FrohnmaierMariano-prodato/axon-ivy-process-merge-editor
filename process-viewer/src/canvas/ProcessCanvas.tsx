import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, type NodeTypes, type EdgeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import type { ProcessDocument } from '../model/schema-types';
import type { ProcessDiffResult } from '../diff/types';
import { layoutProcess } from './layout';
import { ElementNode } from './ElementNode';
import { ConnectorEdge } from './ConnectorEdge';
import { LaneNode } from './LaneNode';

const nodeTypes: NodeTypes = { processElement: ElementNode, lane: LaneNode };
const edgeTypes: EdgeTypes = { connector: ConnectorEdge };

export interface ProcessCanvasProps {
  document: ProcessDocument;
  diff?: ProcessDiffResult;
  onSelectElement?: (elementId: string | undefined) => void;
}

export function ProcessCanvas({ document, diff, onSelectElement }: ProcessCanvasProps) {
  const { nodes, edges } = useMemo(() => layoutProcess(document, diff), [document, diff]);

  return (
    <ReactFlowProvider>
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
        <MiniMap className="process-minimap" pannable zoomable />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
