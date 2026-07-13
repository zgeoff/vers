import { Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';

const CHARACTER_FRAMES: ReadonlyArray<string> = ['Vanguard', 'Support', 'Striker'];

const panel = css({
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderWidth: '[1px]',
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  margin: '6',
  padding: '6',
});

const lootPanel = css({
  backgroundColor: 'bg.panelElevated',
  padding: '4',
});

const characterFrameRow = css({
  display: 'flex',
  gap: '3',
});

const characterFrame = css({
  backgroundColor: 'bg.panelElevated',
  flex: '1',
  padding: '3',
  textAlign: 'center',
});

/**
 * Placeholder activity screen: static loot and character-frame blocks stand in until combat
 * rewards and party state are wired up.
 */
export function ActivityPanel() {
  return (
    <main className={panel}>
      <Heading level={1}>Activity</Heading>
      <div className={lootPanel} data-testid="loot-panel">
        <Text>Loot drops will appear here once combat rewards are wired up.</Text>
      </div>
      <div className={characterFrameRow}>
        {CHARACTER_FRAMES.map((label) => (
          <div key={label} className={characterFrame} data-testid="character-frame">
            <Text>{label}</Text>
          </div>
        ))}
      </div>
    </main>
  );
}
