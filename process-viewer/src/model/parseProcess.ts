import type { ProcessDocument, ProcessElement } from './schema-types';

export class ProcessParseError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively validates/normalizes a raw element node. Tolerant by design:
 * unknown extra fields are kept as-is (via passthrough), only `id` and `type`
 * are required for an element to be usable at all.
 */
function normalizeElement(raw: unknown, path: string): ProcessElement {
  if (!isRecord(raw)) {
    throw new ProcessParseError(`Element at ${path} is not an object`);
  }
  const { id, type } = raw;
  if (typeof id !== 'string' || id.length === 0) {
    throw new ProcessParseError(`Element at ${path} is missing a string "id"`);
  }
  if (typeof type !== 'string' || type.length === 0) {
    throw new ProcessParseError(`Element ${path} (id=${id}) is missing a string "type"`);
  }

  const elements = Array.isArray(raw.elements)
    ? raw.elements.map((el, i) => normalizeElement(el, `${path}.elements[${i}]`))
    : undefined;
  const boundaries = Array.isArray(raw.boundaries)
    ? raw.boundaries.map((el, i) => normalizeElement(el, `${path}.boundaries[${i}]`))
    : undefined;

  return {
    ...raw,
    id,
    type,
    elements,
    boundaries
  } as ProcessElement;
}

/**
 * Parses raw JSON (already `JSON.parse`d) into a typed {@link ProcessDocument}.
 * Tolerant of unknown/extra fields and unknown element `type` values (those are
 * kept as-is and rendered generically by the canvas layer) - only fails if the
 * mandatory top-level shape (`id` + `elements[]`) is missing, so callers can
 * show a clear error instead of the app crashing on unexpected input.
 */
export function parseProcess(raw: unknown): ProcessDocument {
  if (!isRecord(raw)) {
    throw new ProcessParseError('Root of a .p.json file must be a JSON object');
  }
  if (typeof raw.id !== 'string' || raw.id.length === 0) {
    throw new ProcessParseError('Root object is missing a string "id" field');
  }
  if (!Array.isArray(raw.elements)) {
    throw new ProcessParseError('Root object is missing an "elements" array');
  }

  const elements = raw.elements.map((el, i) => normalizeElement(el, `elements[${i}]`));

  return {
    ...raw,
    id: raw.id,
    elements
  } as ProcessDocument;
}

/** Parses a `.p.json` file's text content into a {@link ProcessDocument}. */
export function parseProcessText(text: string): ProcessDocument {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new ProcessParseError(`File is not valid JSON: ${(e as Error).message}`);
  }
  return parseProcess(json);
}

/** Flattens an element tree (elements + boundaries, recursively) into a single list. */
export function flattenElements(elements: ProcessElement[]): ProcessElement[] {
  const result: ProcessElement[] = [];
  const visit = (list: ProcessElement[]) => {
    for (const el of list) {
      result.push(el);
      if (el.boundaries) visit(el.boundaries);
      if (el.elements) visit(el.elements);
    }
  };
  visit(elements);
  return result;
}
