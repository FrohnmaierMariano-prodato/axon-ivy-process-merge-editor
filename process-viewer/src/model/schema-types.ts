/**
 * Minimal, tolerant TypeScript types for the Axon Ivy process (`*.p.json`) file
 * format, modeled after the published v12 schema:
 * https://json-schema.axonivy.com/process/12.0.0/process.json
 *
 * These types are intentionally loose (lots of `unknown` / optional fields) so
 * that both v12 files and future/unknown-shape (e.g. v14) files can be parsed
 * without throwing, falling back to a generic rendering when a `type` or
 * `config` shape isn't recognized.
 */

export interface VisualPoint {
  x: number;
  y: number;
}

export interface VisualSize {
  width: number;
  height: number;
}

export interface VisualConnectorLabel {
  /** May be a single line, or multiple lines (rendered stacked, like a multi-line element `name`). */
  name?: string | string[];
  offset?: VisualPoint;
  segment?: number;
}

export interface VisualNodeShape {
  at?: VisualPoint;
  size?: VisualSize;
  color?: string;
  description?: string;
  icon?: string;
  labelOffset?: VisualPoint;
}

export interface Connector {
  id: string;
  to: string;
  color?: string;
  condition?: string;
  label?: VisualConnectorLabel;
  outVar?: string;
  var?: string;
  via?: VisualPoint[];
}

export interface VisualLane {
  name?: string;
  color?: string;
  description?: string;
  offset?: number;
  size?: number;
  lanes?: VisualLane[];
}

export interface VisualLayout {
  colors?: Record<string, string>;
  lanes?: VisualLane[];
}

/**
 * The full set of element `type` values known from the v12 schema. Kept as a
 * plain string union (not a strict enum) so parsing never fails on an unknown
 * or future (e.g. v14) type - unrecognized values just fall back to a generic
 * "activity" rendering, see `model/elementCategory.ts`.
 */
export type KnownElementType =
  | 'Alternative'
  | 'CallSubEnd'
  | 'CallSubStart'
  | 'CallableSubProcess'
  | 'Database'
  | 'DialogCall'
  | 'EMail'
  | 'EmbeddedEnd'
  | 'EmbeddedProcessElement'
  | 'EmbeddedStart'
  | 'ErrorBoundaryEvent'
  | 'ErrorEnd'
  | 'ErrorStartEvent'
  | 'GenericActivity'
  | 'GenericBpmnElement'
  | 'HtmlDialogEnd'
  | 'HtmlDialogEventStart'
  | 'HtmlDialogExit'
  | 'HtmlDialogMethodStart'
  | 'HtmlDialogProcess'
  | 'HtmlDialogStart'
  | 'Join'
  | 'ManualBpmnElement'
  | 'Process'
  | 'ProcessAnnotation'
  | 'ProgramInterface'
  | 'ProgramStart'
  | 'ReceiveBpmnElement'
  | 'RequestStart'
  | 'RestClientCall'
  | 'RuleBpmnElement'
  | 'Script'
  | 'ScriptBpmnElement'
  | 'SendBpmnElement'
  | 'ServiceBpmnElement'
  | 'SignalBoundaryEvent'
  | 'SignalStartEvent'
  | 'Split'
  | 'SubProcessCall'
  | 'TaskEnd'
  | 'TaskEndPage'
  | 'TaskSwitchEvent'
  | 'TaskSwitchGateway'
  | 'ThirdPartyProgramInterface'
  | 'ThirdPartyProgramStart'
  | 'ThirdPartyWaitEvent'
  | 'TriggerCall'
  | 'UserBpmnElement'
  | 'UserTask'
  | 'WaitEvent'
  | 'WebServiceCall'
  | 'WebserviceEnd'
  | 'WebserviceProcess'
  | 'WebserviceStart';

/** Any element `type` string - known ones get typed shapes/icons, others fall back generically. */
export type ElementType = KnownElementType | (string & {});

export interface ProcessElement {
  id: string;
  type: ElementType;
  impl?: string;
  name?: string | string[];
  /** Per-type configuration payload; shape depends on `type` - kept generic. */
  config?: Record<string, unknown>;
  /** Nested elements, used by container types like EmbeddedProcessElement. */
  elements?: ProcessElement[];
  /** Boundary events attached to this element (e.g. ErrorBoundaryEvent). */
  boundaries?: ProcessElement[];
  docs?: Record<string, string>;
  tags?: string[];
  visual?: VisualNodeShape;
  layout?: VisualLayout;
  parentConnector?: string;
  connect?: Connector[];
}

export type ProcessKind = 'NORMAL' | 'WEB_SERVICE' | 'CALLABLE_SUB' | 'HTML_DIALOG';

export interface ProcessDocument {
  $schema?: string;
  id: string;
  kind?: ProcessKind;
  config?: Record<string, unknown>;
  elements: ProcessElement[];
  layout?: VisualLayout;
  description?: string;
  docs?: Record<string, string>;
}
