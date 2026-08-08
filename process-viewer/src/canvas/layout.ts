import type { Edge, Node } from '@xyflow/react';
import { classifyElementType, DEFAULT_SIZE } from '../model/elementCategory';
import { hasHiddenChildren } from '../icons/activityBadge';
import type { Connector, ProcessDocument, ProcessElement, VisualLane, VisualPoint } from '../model/schema-types';
import type { ProcessDiffResult } from '../diff/types';
import type { ElementNodeData } from './ElementNode';
import type { ConnectorEdgeData } from './ConnectorEdge';
import type { LaneNodeData } from './LaneNode';

export interface LayoutResult {
  nodes: Node<ElementNodeData | LaneNodeData>[];
  edges: Edge<ConnectorEdgeData>[];
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Side = 'left' | 'right' | 'top' | 'bottom';

function isHorizontalSide(side: Side): boolean {
  return side === 'left' || side === 'right';
}

function opposite(side: Side): Side {
  switch (side) {
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
  }
}

function centerOf(rect: Rect): VisualPoint {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function anchorOnRect(rect: Rect, side: Side): VisualPoint {
  switch (side) {
    case 'left':
      return { x: rect.x, y: rect.y + rect.height / 2 };
    case 'right':
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
    case 'top':
      return { x: rect.x + rect.width / 2, y: rect.y };
    case 'bottom':
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
  }
}

/** Which side of `from` the point `to` dominantly lies on (used to pick an exit/entry side). */
function pickSide(from: VisualPoint, to: VisualPoint): Side {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

/**
 * Point where the straight line from `rect`'s center toward `target` crosses `rect`'s boundary -
 * used for connectors that don't specify any `via` points, which Designer draws as a single plain
 * straight line (diagonal if source/target aren't aligned), not an orthogonal bend.
 */
function intersectRectFromCenter(rect: Rect, target: VisualPoint): VisualPoint {
  const center = centerOf(rect);
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const scaleX = dx !== 0 ? halfWidth / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfHeight / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

/**
 * Expands a raw point sequence (source anchor, via points, target anchor) into a strictly
 * orthogonal (Manhattan-style) polyline, inserting a right-angle bend for any consecutive pair
 * that isn't already axis-aligned - this matches how Axon Ivy Designer always routes connectors
 * with sharp horizontal/vertical segments, never diagonal lines.
 */
function makeOrthogonal(points: VisualPoint[], sourceSide: Side, targetSide: Side): VisualPoint[] {
  const result: VisualPoint[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const sameX = Math.abs(a.x - b.x) < 1;
    const sameY = Math.abs(a.y - b.y) < 1;
    if (sameX || sameY) {
      result.push(b);
      continue;
    }
    const isFirst = i === 0;
    const isLast = i === points.length - 2;
    let horizontalFirst: boolean;
    if (isFirst) horizontalFirst = isHorizontalSide(sourceSide);
    else if (isLast) horizontalFirst = !isHorizontalSide(targetSide);
    else horizontalFirst = true;
    const bend = horizontalFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
    result.push(bend, b);
  }
  return result;
}

const LANE_LABEL_WIDTH = 22;

/**
 * Flattens a `.p.json` file's `layout.lanes` (a list of pools, each optionally subdividing into
 * horizontal lanes) into absolutely-positioned bands spanning from x=0 to `maxX`, mirroring
 * Designer's swimlane pool/lane view. Lanes without an explicit `offset` stack directly below the
 * previous sibling, matching how Designer only stores lane `size` (not each one's own offset).
 */
function buildLaneNodes(lanes: VisualLane[] | undefined, maxX: number): Node<LaneNodeData>[] {
  if (!lanes || lanes.length === 0) return [];
  const laneNodes: Node<LaneNodeData>[] = [];

  lanes.forEach((pool, poolIndex) => {
    const poolOffset = pool.offset ?? 0;
    const poolSize = pool.size ?? 0;
    laneNodes.push({
      id: `__pool_${poolIndex}`,
      type: 'lane',
      position: { x: 0, y: poolOffset },
      data: { label: pool.name, variant: 'pool' },
      style: { width: maxX, height: poolSize },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1
    });

    let cursor = poolOffset;
    (pool.lanes ?? []).forEach((lane, laneIndex) => {
      const laneOffset = lane.offset ?? cursor;
      const laneSize = lane.size ?? 0;
      laneNodes.push({
        id: `__pool_${poolIndex}_lane_${laneIndex}`,
        type: 'lane',
        position: { x: LANE_LABEL_WIDTH, y: laneOffset },
        data: { label: lane.name, variant: 'lane' },
        style: { width: Math.max(maxX - LANE_LABEL_WIDTH, 0), height: laneSize },
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: -1
      });
      cursor = laneOffset + laneSize;
    });
  });

  return laneNodes;
}

/**
 * Converts a parsed process document into React Flow nodes/edges.
 *
 * Coordinates: Axon Ivy Designer stores each element's `visual.at` as the *center* of its
 * bounding box (not the top-left corner) - this is what lets elements of very different sizes
 * (e.g. a 32x32 start circle and a 100x64 activity box) share the exact same `at.y` and still end
 * up perfectly aligned on the same visual row. We convert to a top-left `position` (what React
 * Flow expects) by subtracting half the element's size.
 *
 * Nesting: elements inside a container's `elements[]` become React Flow child
 * nodes (`parentId`), positioned relative to the container's origin - this
 * matches how Axon Ivy stores embedded-subprocess coordinates. `boundaries[]`
 * (e.g. an ErrorBoundaryEvent on an activity) use their own real `visual.at`
 * too (same center convention, in the same frame as their owning activity),
 * only falling back to a synthetic bottom-right pin if that's ever missing.
 *
 * Connector routing is computed in two phases: phase 1 walks the element tree collecting each
 * node's local rect/parent, phase 2 (once every rect is known) resolves absolute rects and builds
 * each connector's path - a plain straight line (possibly diagonal) when it has no `via` points,
 * matching Designer's default rendering, or an orthogonal (right-angle) path through them when it
 * does, matching Designer's rendering once a waypoint has been dragged onto the connector - see
 * {@link intersectRectFromCenter} and {@link makeOrthogonal}.
 */
export function layoutProcess(doc: ProcessDocument, diff?: ProcessDiffResult): LayoutResult {
  const nodes: Node<ElementNodeData>[] = [];
  const localRectById = new Map<string, Rect>();
  const parentById = new Map<string, string | undefined>();
  // `frameOwnerId` is whose coordinate frame a connector's `via` points are authored in - normally
  // the owner itself, but boundary events are a special case (see below).
  const pendingConnectors: { ownerId: string; frameOwnerId: string; connectors: Connector[] }[] = [];

  const visit = (elements: ProcessElement[], parentId: string | undefined) => {
    for (const element of elements) {
      const category = classifyElementType(element.type);
      const size = element.visual?.size ?? DEFAULT_SIZE[category];
      const center = element.visual?.at ?? { x: 0, y: 0 };
      const position = { x: center.x - size.width / 2, y: center.y - size.height / 2 };
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
      localRectById.set(element.id, { x: position.x, y: position.y, width: size.width, height: size.height });
      parentById.set(element.id, parentId);
      if (element.connect && element.connect.length > 0) {
        pendingConnectors.push({ ownerId: element.id, frameOwnerId: element.id, connectors: element.connect });
      }

      // BPMN activity types (GenericBpmnElement, ScriptBpmnElement, ...) render collapsed in
      // Designer - their nested elements only become visible via drill-down (the `J` shortcut),
      // not laid out inline, so we skip recursing into them here.
      if (element.elements && element.elements.length > 0 && !hasHiddenChildren(element.type)) {
        visit(element.elements, element.id);
      }

      if (element.boundaries && element.boundaries.length > 0) {
        for (const [i, boundary] of element.boundaries.entries()) {
          const boundaryCategory = classifyElementType(boundary.type);
          const boundarySize = boundary.visual?.size ?? DEFAULT_SIZE[boundaryCategory];
          const boundaryStatus = diff?.elements.get(boundary.id)?.status ?? 'unchanged';
          // A boundary event's `visual.at` is authored in the same frame as its owning activity's
          // own `at` (i.e. the activity's parent's frame), not relative to the activity itself -
          // so we convert it to top-left and then subtract the activity's own top-left (`position`,
          // already in that same frame) to get the local position React Flow needs for a child node.
          const boundaryCenter = boundary.visual?.at;
          const boundaryPosition = boundaryCenter
            ? { x: boundaryCenter.x - boundarySize.width / 2 - position.x, y: boundaryCenter.y - boundarySize.height / 2 - position.y }
            : { x: size.width - boundarySize.width / 2 - i * (boundarySize.width + 4), y: size.height - boundarySize.height / 2 };
          nodes.push({
            id: boundary.id,
            type: 'processElement',
            position: boundaryPosition,
            parentId: element.id,
            data: { element: boundary, status: boundaryStatus },
            style: { width: boundarySize.width, height: boundarySize.height },
            draggable: false,
            selectable: true
          });
          localRectById.set(boundary.id, { ...boundaryPosition, width: boundarySize.width, height: boundarySize.height });
          parentById.set(boundary.id, element.id);
          if (boundary.connect && boundary.connect.length > 0) {
            // Unlike a real React Flow child, a boundary event's `visual.at`/`connect.via` coordinates
            // (per the .p.json format) are authored in its *owning activity's* frame, not a new nested
            // frame introduced by the synthetic bottom-right pinning above - so `via` points must be
            // offset using the activity's frame (`element.id`), not the boundary's own.
            pendingConnectors.push({ ownerId: boundary.id, frameOwnerId: element.id, connectors: boundary.connect });
          }
        }
      }
    }
  };

  visit(doc.elements, undefined);

  // Phase 2: resolve absolute rects (summing parent offsets) now that every node is known, then
  // build a fully orthogonal edge path per connector.
  const absoluteCache = new Map<string, Rect>();
  const absoluteRect = (id: string): Rect => {
    const cached = absoluteCache.get(id);
    if (cached) return cached;
    const local = localRectById.get(id) ?? { x: 0, y: 0, width: 0, height: 0 };
    const parentId = parentById.get(id);
    const abs = parentId ? { ...local, x: local.x + absoluteRect(parentId).x, y: local.y + absoluteRect(parentId).y } : local;
    absoluteCache.set(id, abs);
    return abs;
  };
  /** Absolute position of `id`'s own coordinate frame (i.e. its parent's absolute origin, or the canvas origin at the root). */
  const frameOffset = (id: string): VisualPoint => {
    const parentId = parentById.get(id);
    return parentId ? absoluteRect(parentId) : { x: 0, y: 0 };
  };

  /**
 * A point at the given fraction (0-1) of the total path length - used as the default label
 * position when a connector doesn't specify a `label.segment`.
 */
function pointAtFraction(points: VisualPoint[], fraction: number): VisualPoint {
  const segmentLengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const total = segmentLengths.reduce((a, b) => a + b, 0);
  let remaining = total * fraction;
  for (let i = 0; i < segmentLengths.length; i++) {
    const len = segmentLengths[i];
    if (remaining <= len || i === segmentLengths.length - 1) {
      const t = len === 0 ? 0 : Math.min(remaining / len, 1);
      const a = points[i];
      const b = points[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= len;
  }
  return points[points.length - 1];
}

/**
 * Resolves a connector label's anchor point using Designer's `label.segment` hint (1-based index
 * into the path's straight segments, with the fractional part being progress along that segment)
 * when present, else the path's overall midpoint - then applies `label.offset` as a final pixel
 * nudge, exactly as Designer does.
 */
function labelPoint(points: VisualPoint[], label: { segment?: number; offset?: VisualPoint } | undefined): VisualPoint {
  let base: VisualPoint;
  if (label?.segment !== undefined && points.length >= 2) {
    const segmentCount = points.length - 1;
    const index = Math.min(Math.max(Math.floor(label.segment) - 1, 0), segmentCount - 1);
    const fraction = label.segment - Math.floor(label.segment);
    const a = points[index];
    const b = points[index + 1];
    base = { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction };
  } else {
    base = pointAtFraction(points, 0.5);
  }
  return { x: base.x + (label?.offset?.x ?? 0), y: base.y + (label?.offset?.y ?? 0) };
}

function labelText(name: string | string[] | undefined): string | undefined {
  if (Array.isArray(name)) return name.join(' ');
  return name;
}

const edges: Edge<ConnectorEdgeData>[] = [];
  for (const { ownerId, frameOwnerId, connectors } of pendingConnectors) {
    const sourceRect = absoluteRect(ownerId);
    const offset = frameOffset(frameOwnerId);
    for (const connector of connectors) {
      // Skip dangling references (e.g. to an id inside a collapsed/hidden container) rather
      // than drawing a stray line to the canvas origin.
      if (!localRectById.has(connector.to)) continue;

      const targetRect = absoluteRect(connector.to);
      const viaAbsolute = (connector.via ?? []).map(p => ({ x: p.x + offset.x, y: p.y + offset.y }));

      const sourceCenter = centerOf(sourceRect);
      const targetCenter = centerOf(targetRect);

      let points: VisualPoint[];
      if (viaAbsolute.length === 0) {
        // No via points authored - Designer draws one plain straight line between the shapes'
        // boundaries (diagonal if they aren't aligned), *not* a forced right-angle bend.
        points = [intersectRectFromCenter(sourceRect, targetCenter), intersectRectFromCenter(targetRect, sourceCenter)];
      } else {
        // Via points are manually-placed bends - route orthogonally through them, matching how
        // Designer draws a connector once you've dragged a waypoint onto it.
        const firstDirectionPoint = viaAbsolute[0];
        const lastDirectionPoint = viaAbsolute[viaAbsolute.length - 1];
        const sourceSide = pickSide(sourceCenter, firstDirectionPoint);
        const targetSide = opposite(pickSide(lastDirectionPoint, targetCenter));
        const rawPoints = [anchorOnRect(sourceRect, sourceSide), ...viaAbsolute, anchorOnRect(targetRect, targetSide)];
        points = makeOrthogonal(rawPoints, sourceSide, targetSide);
      }

      const connectorStatus = diff?.connectors.get(`${ownerId}::${connector.id}`)?.status ?? 'unchanged';
      edges.push({
        id: `${ownerId}::${connector.id}`,
        source: ownerId,
        target: connector.to,
        type: 'connector',
        data: { points, label: labelText(connector.label?.name), labelPoint: labelPoint(points, connector.label), status: connectorStatus }
      });
    }
  }

  // Pool/lane bands span the full width of the diagram, based on the widest top-level element.
  const maxX = nodes.reduce((max, n) => {
    if (n.parentId) return max;
    const width = typeof n.style?.width === 'number' ? n.style.width : 0;
    return Math.max(max, n.position.x + width);
  }, 0);
  const laneNodes = buildLaneNodes(doc.layout?.lanes, maxX + 80);

  return { nodes: [...laneNodes, ...nodes], edges };
}
