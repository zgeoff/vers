import { Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';

const panel = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  padding: '6',
});

const placeholderGrid = css({
  display: 'grid',
  gap: '4',
  gridTemplateColumns: 'repeat(2, 1fr)',
});

const placeholder = css({
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderRadius: 'md',
  borderWidth: '[1px]',
  color: 'text.muted',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '[12rem]',
  padding: '6',
});

/**
 * Codex stub: the reference and enemy compendium is not built yet, so labelled placeholders stand
 * in for its future panels.
 */
export function CodexPanel() {
  return (
    <main className={panel}>
      <Heading level={2}>Codex</Heading>
      <Text>Reference and enemy compendium — coming soon.</Text>
      <div className={placeholderGrid}>
        <div className={placeholder}>
          <Text>Reference categories</Text>
        </div>
        <div className={placeholder}>
          <Text>Entry detail</Text>
        </div>
      </div>
    </main>
  );
}
