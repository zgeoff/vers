import { SatelliteHost } from '@vers/game-rendering';
import { css } from '@vers/styled-system/css';

const stack = css({
  bottom: '6',
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  position: 'fixed',
  right: '6',
});

/**
 * Positions every registered satellite widget as a card stack fixed to the bottom-right of the
 * viewport, above the persistent canvas and clear of the top-anchored nav.
 */
export function SatelliteStack() {
  return (
    <div className={stack}>
      <SatelliteHost />
    </div>
  );
}
