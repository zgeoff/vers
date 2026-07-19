import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { CodexPanel } from './codex-panel';

test('it renders the codex heading and placeholder panels', async () => {
  renderWithRouter(<CodexPanel />);

  const heading = await screen.findByRole('heading', { name: 'Codex' });

  expect(heading).toBeInTheDocument();
  expect(screen.getByText('Reference categories')).toBeInTheDocument();
  expect(screen.getByText('Entry detail')).toBeInTheDocument();
});
