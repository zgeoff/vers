import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { registerSatellite } from './register-satellite';
import { removeSatellite } from './remove-satellite';

export function useSatellite(id: string, element: ReactNode, keepAlive = false): void {
  useEffect(() => {
    registerSatellite(id, { element, keepAlive });
  });

  useEffect(
    () => () => {
      if (!keepAlive) {
        removeSatellite(id);
      }
    },
    [id, keepAlive],
  );
}
