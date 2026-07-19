import { Tabs } from '@vers/design-system';
import type { ReactNode } from 'react';
import { AccountScreen } from '../-account/account-screen';
import { ScreenLayout } from '../../components/screen-layout';
import { ScreenPanel } from '../../components/screen-panel';

interface SettingsScreenProps {
  readonly Content: ReactNode;
  readonly has2FA: boolean;
}

export function SettingsScreen(props: Readonly<SettingsScreenProps>) {
  return (
    <ScreenLayout title="Settings">
      <Tabs
        items={[
          {
            content: <AccountScreen Content={props.Content} has2FA={props.has2FA} />,
            label: 'Account',
            value: 'account',
          },
          { content: <GameTab />, label: 'Game', value: 'game' },
          { content: <AudioTab />, label: 'Audio', value: 'audio' },
          { content: <InterfaceTab />, label: 'Interface', value: 'interface' },
        ]}
      />
    </ScreenLayout>
  );
}

function GameTab() {
  return (
    <>
      <ScreenPanel label="Automation — auto-engage / auto-loot" />
      <ScreenPanel label="Offline progress" />
      <ScreenPanel label="Confirmations — sell / dismantle" />
    </>
  );
}

function AudioTab() {
  return (
    <>
      <ScreenPanel label="Master volume" />
      <ScreenPanel label="Music" />
      <ScreenPanel label="Effects" />
    </>
  );
}

function InterfaceTab() {
  return (
    <>
      <ScreenPanel label="Theme · damage numbers · tooltips" />
      <ScreenPanel label="Language" />
      <ScreenPanel label="Notifications" />
    </>
  );
}
