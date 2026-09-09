import { useCallback, useEffect, useState } from 'react';
import type { CanvasOrientation } from './useCanvasOrientation';

const MIN_RATIO = 0.15;
const MAX_RATIO = 0.85;
const DEFAULT_RATIO = 0.5;
const STORAGE_KEY = 'processViewer.diffSplitRatio';

function readStoredRatio(): number {
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(stored) && stored >= MIN_RATIO && stored <= MAX_RATIO ? stored : DEFAULT_RATIO;
}

/**
 * Drag-to-resize state for the divider between the two diff panes. The ratio is the fraction of the
 * split container taken by the first (left/top) pane; it is derived from the pointer's absolute
 * position within `containerRef` so it works identically for the side-by-side and stacked layouts.
 */
export function useSplitRatio(containerRef: React.RefObject<HTMLElement | null>, orientation: CanvasOrientation) {
  const [ratio, setRatio] = useState<number>(readStoredRatio);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const raw =
        orientation === 'vertical'
          ? (event.clientY - rect.top) / rect.height
          : (event.clientX - rect.left) / rect.width;
      setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, raw)));
    };
    const handlePointerUp = () => setIsDragging(false);

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = orientation === 'vertical' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isDragging, orientation, containerRef]);

  useEffect(() => {
    if (isDragging) return;
    localStorage.setItem(STORAGE_KEY, String(ratio));
  }, [ratio, isDragging]);

  const onHandlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  return { ratio, isDragging, onHandlePointerDown };
}
