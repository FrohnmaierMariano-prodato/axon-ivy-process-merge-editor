import { useCallback, useEffect, useState } from 'react';

export type CanvasOrientation = 'horizontal' | 'vertical';

const STORAGE_KEY = 'processViewer.diffOrientation';

function readStoredOrientation(): CanvasOrientation {
  return localStorage.getItem(STORAGE_KEY) === 'vertical' ? 'vertical' : 'horizontal';
}

/**
 * Persisted toggle for the diff view's split orientation (side-by-side vs. stacked), shared via
 * `localStorage` so the user's preference carries over across sessions.
 */
export function useCanvasOrientation() {
  const [orientation, setOrientation] = useState<CanvasOrientation>(readStoredOrientation);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, orientation);
  }, [orientation]);

  const toggleOrientation = useCallback(() => {
    setOrientation(prev => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
  }, []);

  return { orientation, toggleOrientation };
}
