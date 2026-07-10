import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { StashPanel } from './stash-panel';

test('it renders the stash title and its placeholder item grid', () => {
  render(<StashPanel />);

  expect(screen.getByRole('heading', { name: 'Stash' })).toBeVisible();
  expect(screen.getByTestId('stash-item-grid')).not.toBeEmptyDOMElement();
  expect(screen.getByText('Rusted Shortsword')).toBeVisible();
});
