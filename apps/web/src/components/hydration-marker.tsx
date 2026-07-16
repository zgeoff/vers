import { useEffect } from 'react';

/**
 * Stamps `data-hydrated` on the root element once React has committed the hydrated tree, i.e. once
 * event handlers are live. E2E specs wait for the attribute before driving forms — interacting
 * earlier hits server-rendered markup whose submit falls back to a native GET.
 */
export function HydrationMarker(): null {
  useEffect(() => {
    document.documentElement.dataset['hydrated'] = 'true';
  }, []);

  return null;
}
