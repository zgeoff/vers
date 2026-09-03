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

export function SatelliteStack() {
  return (
    <div className={stack}>
      <SatelliteHost />
    </div>
  );
}
