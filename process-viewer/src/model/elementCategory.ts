import type { ElementType } from './schema-types';

export type ElementCategory =
  | 'start'
  | 'end'
  | 'intermediate'
  | 'boundary'
  | 'gateway'
  | 'activity'
  | 'container'
  | 'annotation';

/** Default (un-styled) size per category, used when `visual.size` is absent. */
export const DEFAULT_SIZE: Record<ElementCategory, { width: number; height: number }> = {
  start: { width: 32, height: 32 },
  end: { width: 32, height: 32 },
  intermediate: { width: 32, height: 32 },
  boundary: { width: 24, height: 24 },
  gateway: { width: 36, height: 36 },
  activity: { width: 100, height: 64 },
  container: { width: 220, height: 140 },
  annotation: { width: 140, height: 60 }
};

const START_TYPES = new Set<ElementType>([
  'RequestStart',
  'SignalStartEvent',
  'ProgramStart',
  'ErrorStartEvent',
  'EmbeddedStart',
  'CallSubStart',
  'WebserviceStart',
  'HtmlDialogStart',
  'HtmlDialogEventStart',
  'HtmlDialogMethodStart',
  'ThirdPartyProgramStart'
]);

const END_TYPES = new Set<ElementType>([
  'TaskEnd',
  'TaskEndPage',
  'ErrorEnd',
  'EmbeddedEnd',
  'CallSubEnd',
  'WebserviceEnd',
  'HtmlDialogEnd',
  'HtmlDialogExit'
]);

const INTERMEDIATE_TYPES = new Set<ElementType>(['TaskSwitchEvent', 'WaitEvent', 'ThirdPartyWaitEvent']);

const BOUNDARY_TYPES = new Set<ElementType>(['ErrorBoundaryEvent', 'SignalBoundaryEvent']);

const GATEWAY_TYPES = new Set<ElementType>(['Alternative', 'Split', 'Join', 'TaskSwitchGateway']);

const CONTAINER_TYPES = new Set<ElementType>([
  'EmbeddedProcessElement',
  'CallableSubProcess',
  'HtmlDialogProcess',
  'WebserviceProcess',
  'Process'
]);

const ANNOTATION_TYPES = new Set<ElementType>(['ProcessAnnotation']);

/**
 * Classifies a raw element `type` into a rendering category. Unknown types
 * (e.g. from a future schema version) fall back to `'activity'`, the most
 * generic/neutral shape (rounded rectangle box).
 */
export function classifyElementType(type: ElementType): ElementCategory {
  if (START_TYPES.has(type)) return 'start';
  if (END_TYPES.has(type)) return 'end';
  if (INTERMEDIATE_TYPES.has(type)) return 'intermediate';
  if (BOUNDARY_TYPES.has(type)) return 'boundary';
  if (GATEWAY_TYPES.has(type)) return 'gateway';
  if (CONTAINER_TYPES.has(type)) return 'container';
  if (ANNOTATION_TYPES.has(type)) return 'annotation';
  return 'activity';
}
