import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { ActivityPanel } from './activity-panel';

test('it renders the activity title, loot panel, and character frames', () => {
  render(<ActivityPanel />);
  expect(screen.getByRole('heading', { name: 'Activity' })).toBeVisible();
  expect(screen.getByTestId('loot-panel')).toBeVisible();
  expect(screen.getAllByTestId('character-frame')).toHaveLength(3);
});
