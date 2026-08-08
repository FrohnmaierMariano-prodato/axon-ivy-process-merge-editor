import type { ElementType } from '../model/schema-types';

/**
 * Names of the small original glyph set drawn in `Glyph.tsx`. These are
 * intentionally simple, custom-drawn pictograms (not copied from Axon Ivy's
 * proprietary icon assets) that hint at what each element type does.
 */
export type GlyphName =
  | 'play'
  | 'stop'
  | 'signal'
  | 'program'
  | 'error'
  | 'subStartDown'
  | 'subEndUp'
  | 'globe'
  | 'dialogInit'
  | 'dialogMethod'
  | 'dialogEvent'
  | 'page'
  | 'exit'
  | 'clock'
  | 'gatewayExclusive'
  | 'gatewayParallel'
  | 'gatewayTaskSwitch'
  | 'switch'
  | 'database'
  | 'monitor'
  | 'mail'
  | 'gear'
  | 'scriptPage'
  | 'rule'
  | 'plug'
  | 'codeBrackets'
  | 'broadcast'
  | 'subProcess'
  | 'trigger'
  | 'userTask'
  | 'webService'
  | 'bpmn'
  | 'folder'
  | 'note'
  | 'generic';

/** Maps every known element `type` to a glyph. Unknown types get `'generic'`. */
const TYPE_TO_GLYPH: Partial<Record<string, GlyphName>> = {
  RequestStart: 'play',
  SignalStartEvent: 'signal',
  ProgramStart: 'program',
  ErrorStartEvent: 'error',
  EmbeddedStart: 'play',
  CallSubStart: 'subStartDown',
  WebserviceStart: 'globe',
  HtmlDialogStart: 'dialogInit',
  HtmlDialogEventStart: 'dialogEvent',
  HtmlDialogMethodStart: 'dialogMethod',
  ThirdPartyProgramStart: 'program',

  TaskEnd: 'stop',
  TaskEndPage: 'page',
  ErrorEnd: 'error',
  EmbeddedEnd: 'stop',
  CallSubEnd: 'subEndUp',
  WebserviceEnd: 'globe',
  HtmlDialogEnd: 'stop',
  HtmlDialogExit: 'exit',

  TaskSwitchEvent: 'switch',
  WaitEvent: 'clock',
  ThirdPartyWaitEvent: 'clock',

  ErrorBoundaryEvent: 'error',
  SignalBoundaryEvent: 'signal',

  Alternative: 'gatewayExclusive',
  Split: 'gatewayParallel',
  Join: 'gatewayParallel',
  TaskSwitchGateway: 'gatewayTaskSwitch',

  Database: 'database',
  DialogCall: 'monitor',
  EMail: 'mail',
  ProgramInterface: 'codeBrackets',
  ReceiveBpmnElement: 'bpmn',
  RestClientCall: 'broadcast',
  RuleBpmnElement: 'rule',
  Script: 'scriptPage',
  ScriptBpmnElement: 'gear',
  SendBpmnElement: 'bpmn',
  ServiceBpmnElement: 'bpmn',
  SubProcessCall: 'subProcess',
  ThirdPartyProgramInterface: 'codeBrackets',
  TriggerCall: 'trigger',
  UserTask: 'userTask',
  WebServiceCall: 'webService',
  GenericActivity: 'generic',
  GenericBpmnElement: 'bpmn',
  ManualBpmnElement: 'bpmn',
  UserBpmnElement: 'bpmn',

  EmbeddedProcessElement: 'folder',
  CallableSubProcess: 'folder',
  HtmlDialogProcess: 'folder',
  WebserviceProcess: 'folder',
  Process: 'folder',

  ProcessAnnotation: 'note'
};

export function glyphForType(type: ElementType): GlyphName {
  return TYPE_TO_GLYPH[type] ?? 'generic';
}
