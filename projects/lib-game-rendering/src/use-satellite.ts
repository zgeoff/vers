import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { registerSatellite } from './register-satellite';
import { removeSatellite } from './remove-satellite';

/**
 * Registers `element` as a satellite under `id` for the lifetime of the calling component.
 * `keepAlive` entries survive the owner's unmount until something else calls `removeSatellite`;
 * non-keepAlive entries (the default) are removed automatically when the owner unmounts.
 */
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
