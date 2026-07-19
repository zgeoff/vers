import { useSatellite } from '@vers/game-rendering';
import { css } from '@vers/styled-system/css';
import type { ReactNode } from 'react';
import { AvatarProgression } from './avatar-progression';
import { AvatarViewer } from './avatar-viewer';

interface AvatarPanelProps {
  readonly Content: ReactNode;
}

const container = css({ display: 'flex', flexDirection: 'column', gap: '4', padding: '6' });

/**
 * Registers the avatar satellite viewer for the panel's lifetime. The viewer is not kept alive, so
 * its canvas dies with the route on navigation away.
 */
export function AvatarPanel(props: Readonly<AvatarPanelProps>) {
  useSatellite('avatar-viewer', <AvatarViewer />);

  return (
    <main className={container}>
      {props.Content}
      <AvatarProgression />
    </main>
  );
}
