import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { useSatelliteStore } from './use-satellite-store';

/**
 * Renders every currently registered satellite element, keyed by its registration id.
 */
export function SatelliteHost(): ReactNode {
  const satellites = useSatelliteStore((state) => state.satellites);

  if (satellites.size === 0) {
    return null;
  }

  return [...satellites.entries()].map(([id, entry]) => (
    <Fragment key={id}>{entry.element}</Fragment>
  ));
}
