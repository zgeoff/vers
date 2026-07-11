import { Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';

/**
 * Shown where the idle simulation would render in a browser without SharedWorker: the rest of the
 * game stays usable, so this reports the degraded feature rather than blocking the screen.
 */
export function SimulationUnsupportedNotice() {
  return (
    <output
      className={css({
        backgroundColor: 'bg.panel',
        borderColor: 'border',
        borderWidth: '[1px]',
        display: 'flex',
        flexDirection: 'column',
        gap: '2',
        padding: '6',
      })}
    >
      <Text bold>Activity simulation is unavailable in this browser</Text>
      <Text className={css({ color: 'text.muted' })}>
        Running activities needs SharedWorker support. Open the game in a desktop browser like
        Chrome or Firefox to use this part of the game — the rest works here.
      </Text>
    </output>
  );
}
