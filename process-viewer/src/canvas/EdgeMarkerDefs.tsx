import { STATUS_STYLE, arrowMarkerId } from './statusColors';
import type { DiffStatus } from '../diff/types';

/**
 * Defines one open-chevron arrowhead marker per diff status color, rendered once and referenced
 * by id from every connector edge. An open chevron (unfilled, just two joined line strokes) reads
 * as a crisper, more elongated arrow tip than React Flow's default filled triangle marker.
 */
export function EdgeMarkerDefs() {
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {(Object.keys(STATUS_STYLE) as DiffStatus[]).map(status => (
          <marker
            key={status}
            id={arrowMarkerId(status)}
            viewBox="0 0 12 12"
            markerWidth={4.5}
            markerHeight={4.5}
            refX={9.5}
            refY={6}
            orient="auto-start-reverse"
          >
            <path d="M1.5,1 L10,6 L1.5,11" fill="none" stroke={STATUS_STYLE[status].stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        ))}
      </defs>
    </svg>
  );
}
