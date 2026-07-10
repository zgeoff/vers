import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { EncounterPanel } from './encounter-panel';

test('it renders the encounter title, loot panel, and character frames', () => {
  render(<EncounterPanel />);

  expect(screen.getByRole('heading', { name: 'Encounter' })).toBeVisible();
  expect(screen.getByTestId('loot-panel')).toBeVisible();
  expect(screen.getAllByTestId('character-frame')).toHaveLength(3);
});
