import type { ProcessDocument, ProcessElement } from './schema-types';
import { extractProcessReference } from './processRegistry';
import { flattenElements } from './parseProcess';
import { hasHiddenChildren } from '../icons/activityBadge';

/**
 * Returns the cross-file process reference a "jumpable" element points at (a callable
 * sub-process, a trigger's target process, or a called user dialog / user task), or
 * `undefined` for elements that don't navigate to another file. Mirrors the Designer jump targets.
 */
export function getElementReference(element: ProcessElement): string | undefined {
  switch (element.type) {
    case 'SubProcessCall':
    case 'TriggerCall': {
      const processCall = element.config?.processCall;
      return extractProcessReference(typeof processCall === 'string' ? processCall : undefined);
    }
    case 'DialogCall':
    case 'UserTask': {
      const dialog = element.config?.dialog;
      return extractProcessReference(typeof dialog === 'string' ? dialog : undefined);
    }
    default:
      return undefined;
  }
}

/** Where a "J" jump on an element would lead: into its own embedded content, or into another file. */
export interface JumpInfo {
  kind: 'embedded' | 'file';
  /** Button/action label describing the connected resource. */
  label: string;
  /** For `file` jumps, the (unresolved) process reference. */
  reference?: string;
}

/** Describes the jump available for an element (if any) - used to gate/label the "open" affordances. */
export function getJumpInfo(element: ProcessElement): JumpInfo | undefined {
  if (hasHiddenChildren(element.type) && element.elements && element.elements.length > 0) {
    return { kind: 'embedded', label: 'Open embedded process' };
  }
  const reference = getElementReference(element);
  if (!reference) return undefined;
  const opensDialog = element.type === 'DialogCall' || element.type === 'UserTask';
  return { kind: 'file', label: opensDialog ? 'Open dialog process' : 'Open called process', reference };
}

/** Builds a sub-document from a collapsed element's embedded `elements`, for drilling one level in. */
export function childDocument(doc: ProcessDocument, elementId: string): ProcessDocument | undefined {
  const element = flattenElements(doc.elements).find(el => el.id === elementId);
  if (!element?.elements || element.elements.length === 0) return undefined;
  return { ...doc, id: element.id, elements: element.elements };
}
