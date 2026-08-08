import type { GlyphName } from './elementTypeIcon';

interface GlyphProps {
  name: GlyphName;
  size?: number;
  className?: string;
}

/**
 * Small original pictogram set (hand-drawn simple shapes, 0-20 viewBox,
 * `currentColor` stroke/fill) - not derived from Axon Ivy's proprietary icon
 * assets, just a lightweight visual hint per element type.
 */
export function Glyph({ name, size = 14, className }: GlyphProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {renderPaths(name)}
    </svg>
  );
}

function renderPaths(name: GlyphName) {
  switch (name) {
    case 'play':
      return <path d="M6 4l10 6-10 6z" fill="currentColor" stroke="none" />;
    case 'stop':
      return <rect x={5} y={5} width={10} height={10} fill="currentColor" stroke="none" />;
    case 'signal':
      return (
        <>
          <path d="M10 3v6" />
          <path d="M5 12a7 7 0 0 1 10 0" />
          <path d="M2.5 15a10.5 10.5 0 0 1 15 0" />
        </>
      );
    case 'program':
      return (
        <>
          <rect x={3} y={4} width={14} height={9} rx={1} />
          <path d="M7 17h6M10 13v4" />
        </>
      );
    case 'error':
      return <path d="M10 3l7 13H3z M10 9v3 M10 14.2v.1" />;
    case 'subStart':
      return (
        <>
          <path d="M10 3v11" />
          <path d="M6 10l4 4 4-4" />
        </>
      );
    case 'globe':
      return (
        <>
          <circle cx={10} cy={10} r={7} />
          <path d="M3 10h14M10 3a11 11 0 0 1 0 14M10 3a11 11 0 0 0 0 14" />
        </>
      );
    case 'dialogInit':
      return (
        <>
          <rect x={3} y={4} width={14} height={12} rx={1} />
          <path d="M3 8h14" />
        </>
      );
    case 'dialogMethod':
      return (
        <>
          <rect x={3} y={4} width={14} height={12} rx={1} />
          <path d="M7 12l2 2 4-4" />
        </>
      );
    case 'dialogEvent':
      return (
        <>
          <rect x={3} y={4} width={14} height={12} rx={1} />
          <path d="M10 8v3l2 2" />
        </>
      );
    case 'page':
      return (
        <>
          <path d="M6 3h6l3 3v11H6z" />
          <path d="M12 3v3h3" />
        </>
      );
    case 'exit':
      return (
        <>
          <path d="M8 4H4v12h4" />
          <path d="M9 10h8M14 6l4 4-4 4" />
        </>
      );
    case 'clock':
      return (
        <>
          <circle cx={10} cy={10} r={7} />
          <path d="M10 6v4l3 2" />
        </>
      );
    case 'diamond':
      return <path d="M10 3l7 7-7 7-7-7z" />;
    case 'split':
      return (
        <>
          <path d="M4 10h4" />
          <path d="M8 10l8-5M8 10l8 5" />
        </>
      );
    case 'join':
      return (
        <>
          <path d="M4 5l8 5-8 5" />
          <path d="M12 10h4" />
        </>
      );
    case 'switch':
      return (
        <>
          <path d="M4 7h9M13 7l-3-3M13 7l-3 3" />
          <path d="M16 13H7M7 13l3-3M7 13l3 3" />
        </>
      );
    case 'database':
      return (
        <>
          <ellipse cx={10} cy={5.5} rx={6} ry={2.5} />
          <path d="M4 5.5v9c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-9" />
          <path d="M4 10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5" />
        </>
      );
    case 'dialog':
      return (
        <>
          <rect x={3} y={4} width={14} height={10} rx={1} />
          <path d="M7 17l1.5-3M13 17l-1.5-3" />
        </>
      );
    case 'mail':
      return (
        <>
          <rect x={3} y={5} width={14} height={10} rx={1} />
          <path d="M3 6l7 5 7-5" />
        </>
      );
    case 'gear':
      return (
        <>
          <circle cx={10} cy={10} r={2.6} />
          <path d="M10 3.5v2M10 14.5v2M3.5 10h2M14.5 10h2M5.4 5.4l1.4 1.4M13.2 13.2l1.4 1.4M14.6 5.4l-1.4 1.4M6.8 13.2l-1.4 1.4" />
        </>
      );
    case 'rule':
      return (
        <>
          <rect x={3} y={3} width={14} height={14} rx={1} />
          <path d="M3 8h14M7 3v14" />
        </>
      );
    case 'plug':
      return (
        <>
          <path d="M7 3v5M13 3v5" />
          <path d="M5 8h10v3a5 5 0 0 1-10 0z" />
          <path d="M10 16v2" />
        </>
      );
    case 'rest':
      return (
        <>
          <path d="M3 6h14M3 10h14M3 14h9" />
        </>
      );
    case 'subProcess':
      return (
        <>
          <rect x={3} y={6} width={14} height={9} rx={1} />
          <path d="M3 9h14" />
        </>
      );
    case 'trigger':
      return (
        <>
          <circle cx={7} cy={10} r={3.2} />
          <path d="M10.5 10h6M13.5 7l3 3-3 3" />
        </>
      );
    case 'userTask':
      return (
        <>
          <circle cx={10} cy={6.5} r={2.8} />
          <path d="M4.5 17c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
        </>
      );
    case 'webService':
      return (
        <>
          <circle cx={10} cy={10} r={7} />
          <path d="M3 10h14" />
          <path d="M10 3c2.2 2 2.2 12 0 14M10 3c-2.2 2-2.2 12 0 14" />
        </>
      );
    case 'bpmn':
      return <rect x={4} y={4} width={12} height={12} rx={2} />;
    case 'folder':
      return (
        <>
          <path d="M3 6a1 1 0 0 1 1-1h4l1.5 2H16a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        </>
      );
    case 'note':
      return (
        <>
          <path d="M4 3h9l3 3v11H4z" />
          <path d="M13 3v3h3M7 9h6M7 12h6M7 15h3" />
        </>
      );
    default:
      return <circle cx={10} cy={10} r={2} fill="currentColor" stroke="none" />;
  }
}
