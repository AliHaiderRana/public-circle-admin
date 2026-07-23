'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'aws-analytics-view-mode';
const CHANGE_EVENT = 'aws-analytics-view-mode-change';

export type AwsViewMode = 'list' | 'grid';

function readStoredMode(): AwsViewMode {
  if (typeof window === 'undefined') return 'list';
  return window.localStorage.getItem(STORAGE_KEY) === 'grid' ? 'grid' : 'list';
}

/**
 * Global list/grid preference shared across every AWS Analytics screen.
 * Persisted in localStorage; a custom event keeps any other mounted instance
 * (or the next page navigated to) in sync immediately.
 */
export function useAwsViewMode(): [AwsViewMode, (mode: AwsViewMode) => void] {
  const [mode, setModeState] = useState<AwsViewMode>('list');

  useEffect(() => {
    setModeState(readStoredMode());
    const sync = () => setModeState(readStoredMode());
    window.addEventListener('storage', sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const setMode = useCallback((next: AwsViewMode) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [mode, setMode];
}
