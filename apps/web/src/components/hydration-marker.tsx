import { useEffect } from 'react';

export function HydrationMarker(): null {
  useEffect(() => {
    document.documentElement.dataset['hydrated'] = 'true';
  }, []);

  return null;
}
