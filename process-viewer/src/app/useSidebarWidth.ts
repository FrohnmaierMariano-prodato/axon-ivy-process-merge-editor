import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_WIDTH = 220;
const MIN_CANVAS_WIDTH = 320;
const DEFAULT_WIDTH = 320;
const STORAGE_KEY = 'processViewer.sidebarWidth';

/** No fixed cap - the sidebar (and its raw-JSON diff) may grow as wide as desired, short of crowding out the canvas. */
function getMaxWidth(): number {
  return Math.max(MIN_WIDTH, window.innerWidth - MIN_CANVAS_WIDTH);
}

function readStoredWidth(): number {
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  const maxWidth = getMaxWidth();
  return Number.isFinite(stored) && stored >= MIN_WIDTH && stored <= maxWidth ? stored : DEFAULT_WIDTH;
}

/**
 * Drag-to-resize state for the detail sidebar, shared (via `localStorage`) between the single and
 * diff views so the user's preferred width carries over when switching tabs. The handle sits on
 * the sidebar's left edge; dragging left/right grows/shrinks it, clamped to a sane range.
 */
export function useSidebarWidth() {
  const [width, setWidth] = useState<number>(readStoredWidth);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragStartRef.current;
      if (!drag) return;
      const delta = drag.pointerX - event.clientX;
      setWidth(Math.min(getMaxWidth(), Math.max(MIN_WIDTH, drag.startWidth + delta)));
    };
    const handlePointerUp = () => {
      dragStartRef.current = null;
      setIsDragging(false);
    };

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) return;
    localStorage.setItem(STORAGE_KEY, String(width));
  }, [width, isDragging]);

  const onHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragStartRef.current = { pointerX: event.clientX, startWidth: width };
      setIsDragging(true);
    },
    [width]
  );

  return { width, isDragging, onHandlePointerDown };
}
