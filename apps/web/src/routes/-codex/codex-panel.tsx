import { Tabs } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { ScreenLayout } from '../../components/screen-layout';
import { ScreenPanel } from '../../components/screen-panel';

/**
 * Codex screen: a reference compendium and an enemy compendium, each a list beside a detail pane —
 * placeholder until the entries are wired.
 */
export function CodexPanel() {
  return (
    <ScreenLayout title="Codex">
      <Tabs
        items={[
          { content: <ReferenceTab />, label: 'Reference', value: 'reference' },
          { content: <EnemiesTab />, label: 'Enemies', value: 'enemies' },
        ]}
      />
    </ScreenLayout>
  );
}

const twoColumns = css({ display: 'grid', gap: '4', gridTemplateColumns: 'repeat(2, 1fr)' });

function ReferenceTab() {
  return (
    <div className={twoColumns}>
      <ScreenPanel label="Categories — Sites · Institutions · Phenomena" />
      <ScreenPanel label="Entry" />
    </div>
  );
}

function EnemiesTab() {
  return (
    <div className={twoColumns}>
      <ScreenPanel label="Enemies — search / filter" />
      <ScreenPanel label="Detail — stats · damage · resistances" />
    </div>
  );
}
