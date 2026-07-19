import { expect, mock, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sheet } from './sheet';

test('it renders the hosted content while open', () => {
  render(
    <Sheet label="Game panel" open>
      <p>panel body</p>
    </Sheet>,
  );

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('panel body')).toBeInTheDocument();
});

test('it renders nothing while closed', () => {
  render(
    <Sheet label="Game panel" open={false}>
      <p>panel body</p>
    </Sheet>,
  );

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('it names the dialog with the given label', () => {
  render(
    <Sheet label="Game panel" open>
      <p>panel body</p>
    </Sheet>,
  );

  expect(screen.getByRole('dialog', { name: 'Game panel' })).toBeInTheDocument();
});

test('it reports a close request from the close trigger', async () => {
  const user = userEvent.setup();
  const onOpenChange = mock<(open: boolean) => void>();

  render(
    <Sheet label="Game panel" onOpenChange={onOpenChange} open>
      <p>panel body</p>
    </Sheet>,
  );

  await user.click(screen.getByRole('button', { name: 'Close' }));

  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
});

test('it reports a close request on escape', async () => {
  const user = userEvent.setup();
  const onOpenChange = mock<(open: boolean) => void>();

  render(
    <Sheet label="Game panel" onOpenChange={onOpenChange} open>
      <p>panel body</p>
    </Sheet>,
  );

  await user.keyboard('{Escape}');

  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
});

test('it reports a close request from the scrim', async () => {
  const user = userEvent.setup();
  const onOpenChange = mock<(open: boolean) => void>();

  render(
    <Sheet label="Game panel" onOpenChange={onOpenChange} open>
      <p>panel body</p>
    </Sheet>,
  );

  await user.click(screen.getByRole('button', { name: 'Dismiss' }));

  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
});
