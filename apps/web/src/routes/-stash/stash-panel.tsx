import { Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';

const STASH_ITEMS: ReadonlyArray<string> = [
  'Worn Traveler Cloak',
  'Rusted Shortsword',
  'Vial of Murky Water',
  'Cracked Leather Satchel',
  'Bundle of Dry Kindling',
  'Tarnished Signet Ring',
];

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

const grid = css({
  display: 'grid',
  gap: '3',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
});

const item = css({
  backgroundColor: 'bg.panelElevated',
  padding: '3',
});

/**
 * Placeholder stash screen rendering a fixed item grid.
 */
export function StashPanel() {
  return (
    <main className={panel}>
      <Heading level={1}>Stash</Heading>
      <div className={grid} data-testid="stash-item-grid">
        {STASH_ITEMS.map((label) => (
          <div key={label} className={item}>
            <Text>{label}</Text>
          </div>
        ))}
      </div>
    </main>
  );
}
