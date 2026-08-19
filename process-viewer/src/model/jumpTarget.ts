import type { ProcessDocument, ProcessElement } from './schema-types';
import { extractProcessReference } from './processRegistry';
import { flattenElements } from './parseProcess';

/**
 * Returns the cross-file process reference a "jumpable" element points at (a callable
 * sub-process, a trigger's target process, or a called user dialog), or `undefined` for
 * elements that don't navigate to another file. Mirrors the Designer "jump" targets.
 */
export function getElementReference(element: ProcessElement): string | undefined {
  switch (element.type) {
    case 'SubProcessCall':
    case 'TriggerCall': {
      const processCall = element.config?.processCall;
      return extractProcessReference(typeof processCall === 'string' ? processCall : undefined);
    }
    case 'DialogCall': {
      const dialog = element.config?.dialog;
      return extractProcessReference(typeof dialog === 'string' ? dialog : undefined);
    }
    default:
      return undefined;
  }
}

/** Builds a sub-document from a collapsed element's embedded `elements`, for drilling one level in. */
export function childDocument(doc: ProcessDocument, elementId: string): ProcessDocument | undefined {
  const element = flattenElements(doc.elements).find(el => el.id === elementId);
  if (!element?.elements || element.elements.length === 0) return undefined;
  return { ...doc, id: element.id, elements: element.elements };
}
