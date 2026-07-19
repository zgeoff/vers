import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { AmbientSheet } from './ambient-sheet';

test('it renders the hosted route content', async () => {
  renderWithRouter(
    <AmbientSheet>
      <p>hosted panel</p>
    </AmbientSheet>,
  );

  const hosted = await screen.findByText('hosted panel');

  expect(hosted).toBeInTheDocument();
});

test('it offers a scrim and a close control to dismiss the sheet', async () => {
  renderWithRouter(
    <AmbientSheet>
      <p>hosted panel</p>
    </AmbientSheet>,
  );

  await screen.findByText('hosted panel');

  expect(screen.getAllByRole('button', { name: /Close/ })).toHaveLength(2);
});
