import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { StashPanel } from './stash-panel';

test('it renders the stash title and its tabs', () => {
  render(<StashPanel />);

  expect(screen.getByRole('heading', { name: 'Stash' })).toBeVisible();
  expect(screen.getByRole('tab', { name: 'Tab 01' })).toBeVisible();
  expect(screen.getByRole('tab', { name: 'Currency' })).toBeVisible();
});
