import type { ElementType } from '../model/schema-types';

/**
 * The 3 activity "families" Axon Ivy Designer groups rectangular activities
 * into (mirrors the palette groups & the lane names used in real processes:
 * "Workflow", "Interface", "BPMN"). Each gets a tinted badge behind its icon
 * so users can tell the family apart at a glance, independent of diff-status
 * coloring (which still drives the outer shape's stroke/fill).
 */
export type ActivityBadgeColor = 'workflow' | 'interface' | 'bpmn';

const WORKFLOW_TYPES = new Set<ElementType>(['DialogCall', 'Script', 'UserTask', 'SubProcessCall', 'TriggerCall', 'TaskSwitchGateway']);

const INTERFACE_TYPES = new Set<ElementType>(['Database', 'WebServiceCall', 'RestClientCall', 'EMail', 'ProgramInterface', 'ThirdPartyProgramInterface']);

const BPMN_TYPES = new Set<ElementType>([
  'GenericBpmnElement',
  'UserBpmnElement',
  'ManualBpmnElement',
  'ScriptBpmnElement',
  'ServiceBpmnElement',
  'RuleBpmnElement',
  'SendBpmnElement',
  'ReceiveBpmnElement'
]);

/** Returns the badge color family for an activity `type`, or `undefined` for non-activity types (events/gateways stay uncolored, like in Designer). */
export function activityBadgeColor(type: ElementType): ActivityBadgeColor | undefined {
  if (WORKFLOW_TYPES.has(type)) return 'workflow';
  if (INTERFACE_TYPES.has(type)) return 'interface';
  if (BPMN_TYPES.has(type)) return 'bpmn';
  return undefined;
}

/**
 * Types whose `elements[]` (nested content) is rendered collapsed in the main
 * diagram - matching Designer, where these BPMN activities show as a plain
 * box with an "expand" marker and their nested elements only become visible
 * when you drill into them (see the app's `J` shortcut), rather than being
 * laid out inline.
 */
const HIDDEN_CHILDREN_TYPES = BPMN_TYPES;

export function hasHiddenChildren(type: ElementType): boolean {
  return HIDDEN_CHILDREN_TYPES.has(type);
}

/** Types that show the small bottom-right "expand" (collapsed sub-process) marker. */
export function hasExpandMarker(type: ElementType): boolean {
  return hasHiddenChildren(type) || type === 'SubProcessCall';
}
