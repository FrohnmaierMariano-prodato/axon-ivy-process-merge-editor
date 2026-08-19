import { Handle, Position, type NodeProps } from '@xyflow/react';
import { classifyElementType, DEFAULT_SIZE, type ElementCategory } from '../model/elementCategory';
import type { ProcessElement } from '../model/schema-types';
import type { DiffStatus } from '../diff/types';
import { STATUS_STYLE } from './statusColors';
import { Glyph } from '../icons/Glyph';
import { glyphForType } from '../icons/elementTypeIcon';
import { activityBadgeColor, hasExpandMarker } from '../icons/activityBadge';
import './ElementNode.css';

export interface ElementNodeData extends Record<string, unknown> {
  element: ProcessElement;
  status: DiffStatus;
}

function elementLabel(element: ProcessElement): string {
  if (Array.isArray(element.name)) return element.name.join(' / ');
  return element.name || element.type;
}

function Shape({ category, width, height, style }: { category: ElementCategory; width: number; height: number; style: ReturnType<typeof getStyle> }) {
  const { stroke, fill, dashProps } = style;
  switch (category) {
    case 'start':
      return <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) / 2 - 1.5} fill={fill} stroke={stroke} strokeWidth={1.5} {...dashProps} />;
    case 'end':
      return <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) / 2 - 1.5} fill={fill} stroke={stroke} strokeWidth={3} {...dashProps} />;
    case 'intermediate':
    case 'boundary':
      return (
        <>
          <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) / 2 - 1.5} fill={fill} stroke={stroke} strokeWidth={1.5} {...dashProps} />
          <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) / 2 - 4.5} fill="none" stroke={stroke} strokeWidth={1.2} />
        </>
      );
    case 'gateway': {
      const points = `${width / 2},1 ${width - 1},${height / 2} ${width / 2},${height - 1} 1,${height / 2}`;
      return <polygon points={points} fill={fill} stroke={stroke} strokeWidth={1.5} {...dashProps} />;
    }
    case 'container':
      return <rect x={1} y={1} width={width - 2} height={height - 2} rx={10} fill={fill} stroke={stroke} strokeWidth={1.5} strokeDasharray="6 4" />;
    case 'annotation':
      return (
        <path
          d={`M2,2 H${width - 14} L${width - 2},14 V${height - 2} H2 Z M${width - 14},2 V14 H${width - 2}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
          {...dashProps}
        />
      );
    case 'activity':
    default:
      return <rect x={1} y={1} width={width - 2} height={height - 2} rx={8} fill={fill} stroke={stroke} strokeWidth={1.5} {...dashProps} />;
  }
}

function getStyle(status: DiffStatus) {
  const s = STATUS_STYLE[status];
  return { stroke: s.stroke, fill: s.fill, dashProps: s.dashed ? { strokeDasharray: '5 4' } : {} };
}

export function ElementNode({ data }: NodeProps & { data: ElementNodeData }) {
  const { element, status } = data;
  const category = classifyElementType(element.type);
  const size = element.visual?.size ?? DEFAULT_SIZE[category];
  const style = getStyle(status);
  const label = elementLabel(element);
  const isEventLike = category === 'start' || category === 'end' || category === 'intermediate' || category === 'boundary';
  const badgeColor = category === 'activity' ? activityBadgeColor(element.type) : undefined;
  const showExpandMarker = hasExpandMarker(element.type);

  return (
    <div className={`element-node element-node--${category}`} style={{ width: size.width, height: size.height }} title={`${element.type} (${element.id})`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <svg width={size.width} height={size.height} className="element-node__shape">
        <Shape category={category} width={size.width} height={size.height} style={style} />
      </svg>
      {category !== 'container' && (
        <div className={`element-node__icon${badgeColor ? ` element-node__icon--badge element-node__icon--${badgeColor}` : ''}`} style={{ color: badgeColor ? undefined : style.stroke }}>
          <Glyph name={glyphForType(element.type)} size={category === 'activity' ? 15 : 12} />
        </div>
      )}
      {showExpandMarker && (
        <div className="element-node__expand-marker" style={{ borderColor: style.stroke }} title="Press J to open the connected process">
          <svg width={9} height={9} viewBox="0 0 9 9">
            <path d="M4.5 1v7M1 4.5h7" stroke={style.stroke} strokeWidth={1.3} />
          </svg>
        </div>
      )}
      {category === 'container' ? (
        <div className="element-node__container-label">{label}</div>
      ) : isEventLike || category === 'gateway' ? (
        <div className="element-node__label element-node__label--below">{label}</div>
      ) : (
        <div className="element-node__label">{label}</div>
      )}
    </div>
  );
}
