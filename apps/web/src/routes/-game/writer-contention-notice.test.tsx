import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { setSimulationInitialized, setWriterContention } from '@vers/idle-client';
import { render } from '../../test-utils/render';
import { WriterContentionNotice } from './writer-contention-notice';

test('it renders nothing while no other version contends for the writer', () => {
  render(<WriterContentionNotice />);

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it asks a tab that never initialized to close the other version', () => {
  setWriterContention(true);
  render(<WriterContentionNotice />);

  expect(screen.getByText('Another version is still running')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
});

test('it asks an initialized tab to reload into the waiting version', () => {
  setSimulationInitialized(true);
  setWriterContention(true);
  render(<WriterContentionNotice />);

  expect(screen.getByText('A newer version is ready')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
});

test('it closes once the writer is ready', () => {
  setWriterContention(true);

  const rendered = render(<WriterContentionNotice />);

  setWriterContention(false);

  rendered.rerender(<WriterContentionNotice />);

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
