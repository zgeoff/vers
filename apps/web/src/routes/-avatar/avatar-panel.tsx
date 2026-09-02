import { Tabs } from '@vers/design-system';
import { useSatellite } from '@vers/game-rendering';
import { css } from '@vers/styled-system/css';
import type { ReactNode } from 'react';
import { ScreenPanel } from '../../components/screen-panel';
import { AvatarProgression } from './avatar-progression';
import { AvatarViewer } from './avatar-viewer';

interface AvatarPanelProps {
  readonly Content: ReactNode;
  readonly placeholder?: boolean;
}

const container = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '5',
  marginX: 'auto',
  maxWidth: 'contentMax',
  padding: '6',
  width: 'full',
});

const threeColumns = css({
  display: 'grid',
  gap: '4',
  gridTemplateColumns: 'repeat(3, 1fr)',
});

const column = css({ display: 'flex', flexDirection: 'column', gap: '4' });
const twoColumns = css({ display: 'grid', gap: '4', gridTemplateColumns: 'repeat(2, 1fr)' });

export function AvatarPanel(props: Readonly<AvatarPanelProps>) {
  useSatellite('avatar-viewer', <AvatarViewer placeholder={props.placeholder ?? false} />);

  return (
    <main className={container}>
      {props.Content}
      <Tabs
        items={[
          { content: <SheetTab />, label: 'Sheet', value: 'sheet' },
          { content: <PassiveTreeTab />, label: 'Passive Tree', value: 'passive-tree' },
        ]}
      />
    </main>
  );
}

function SheetTab() {
  return (
    <div className={threeColumns}>
      <div className={column}>
        <ScreenPanel label="Equipment — paperdoll & slots" />
        <ScreenPanel label="Resources — life / barrier / aether" />
        <ScreenPanel label="Experience">
          <AvatarProgression />
        </ScreenPanel>
      </div>
      <ScreenPanel label="Stats — offence / defence" />
      <div className={column}>
        <ScreenPanel label="Azimuth — melee↔ranged · light↔heavy · innate↔altered" />
        <ScreenPanel label="Abilities — skills & support" />
      </div>
    </div>
  );
}

function PassiveTreeTab() {
  return (
    <>
      <ScreenPanel label="Passive tree — node canvas" />
      <div className={twoColumns}>
        <ScreenPanel label="Cluster" />
        <ScreenPanel label="Keystone" />
      </div>
    </>
  );
}
