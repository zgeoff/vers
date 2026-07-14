import { expect, mock, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from './dialog';

test('it renders the title and content while open', () => {
  render(
    <Dialog open title="Welcome back">
      <p>You were away</p>
    </Dialog>,
  );

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('Welcome back')).toBeInTheDocument();
  expect(screen.getByText('You were away')).toBeInTheDocument();
});

test('it renders nothing while closed', () => {
  render(
    <Dialog open={false} title="Welcome back">
      <p>You were away</p>
    </Dialog>,
  );

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it reports a close request from the close trigger', async () => {
  const user = userEvent.setup();
  const onOpenChange = mock<(open: boolean) => void>();

  render(
    <Dialog onOpenChange={onOpenChange} open title="Welcome back">
      <p>You were away</p>
    </Dialog>,
  );

  await user.click(screen.getByRole('button', { name: 'Close' }));

  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
});

test('it reports a close request on escape', async () => {
  const user = userEvent.setup();
  const onOpenChange = mock<(open: boolean) => void>();

  render(
    <Dialog onOpenChange={onOpenChange} open title="Welcome back">
      <p>You were away</p>
    </Dialog>,
  );

  await user.keyboard('{Escape}');

  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
});

test('it labels the close trigger with the given closeLabel', () => {
  render(
    <Dialog closeLabel="Continue" open title="Welcome back">
      <p>You were away</p>
    </Dialog>,
  );

  expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
});
