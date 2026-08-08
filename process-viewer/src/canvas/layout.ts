import type { Edge, Node } from '@xyflow/react';
import { classifyElementType, DEFAULT_SIZE } from '../model/elementCategory';
import type { ProcessDocument, ProcessElement } from '../model/schema-types';
import type { ProcessDiffResult } from '../diff/types';
import type { ElementNodeData } from './ElementNode';
import type { ConnectorEdgeData } from './ConnectorEdge';

export interface LayoutResult {
  nodes: Node<ElementNodeData>[];
  edges: Edge<ConnectorEdgeData>[];
}

/**
 * Converts a parsed process document into React Flow nodes/edges.
 *
 * Nesting: elements inside a container's `elements[]` become React Flow child
 * nodes (`parentId`), positioned relative to the container's origin - this
 * matches how Axon Ivy stores embedded-subprocess coordinates. `boundaries[]`
 * (e.g. an ErrorBoundaryEvent on an activity) are pinned near the bottom-right
 * corner of their owning node rather than trusting `visual.at`, since boundary
 * events are visually "attached to the border" rather than freely placed.
 */
export function layoutProcess(doc: ProcessDocument, diff?: ProcessDiffResult): LayoutResult {
  const nodes: Node<ElementNodeData>[] = [];
  const edges: Edge<ConnectorEdgeData>[] = [];

  const visit = (elements: ProcessElement[], parentId: string | undefined) => {
    for (const element of elements) {
      const category = classifyElementType(element.type);
      const size = element.visual?.size ?? DEFAULT_SIZE[category];
      const position = element.visual?.at ?? { x: 0, y: 0 };
      const status = diff?.elements.get(element.id)?.status ?? 'unchanged';

      nodes.push({
        id: element.id,
        type: 'processElement',
        position,
        parentId,
        data: { element, status },
        style: { width: size.width, height: size.height },
        draggable: false,
        selectable: true
      });

      for (const connector of element.connect ?? []) {
        const connectorStatus = diff?.connectors.get(`${element.id}::${connector.id}`)?.status ?? 'unchanged';
        edges.push({
          id: `${element.id}::${connector.id}`,
          source: element.id,
          target: connector.to,
          type: 'connector',
          data: { via: connector.via, label: connector.label?.name, status: connectorStatus }
        });
      }

      if (element.elements && element.elements.length > 0) {
        visit(element.elements, element.id);
      }

      if (element.boundaries && element.boundaries.length > 0) {
        for (const [i, boundary] of element.boundaries.entries()) {
          const boundaryCategory = classifyElementType(boundary.type);
          const boundarySize = boundary.visual?.size ?? DEFAULT_SIZE[boundaryCategory];
          const boundaryStatus = diff?.elements.get(boundary.id)?.status ?? 'unchanged';
          nodes.push({
            id: boundary.id,
            type: 'processElement',
            position: { x: size.width - boundarySize.width / 2 - i * (boundarySize.width + 4), y: size.height - boundarySize.height / 2 },
            parentId: element.id,
            data: { element: boundary, status: boundaryStatus },
            style: { width: boundarySize.width, height: boundarySize.height },
            draggable: false,
            selectable: true
          });
          for (const connector of boundary.connect ?? []) {
            const connectorStatus = diff?.connectors.get(`${boundary.id}::${connector.id}`)?.status ?? 'unchanged';
            edges.push({
              id: `${boundary.id}::${connector.id}`,
              source: boundary.id,
              target: connector.to,
              type: 'connector',
              data: { via: connector.via, label: connector.label?.name, status: connectorStatus }
            });
          }
        }
      }
    }
  };

  visit(doc.elements, undefined);
  return { nodes, edges };
}
