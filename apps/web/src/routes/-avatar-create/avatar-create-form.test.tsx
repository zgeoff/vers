import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { AvatarCreateForm } from './avatar-create-form';

test('it renders the name field and submit button', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<AvatarCreateForm />);

    const nameField = await screen.findByLabelText('Name');

    expect(nameField).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Avatar' })).toBeInTheDocument();
  });
});

test('it defaults to Trade mode with no permanence warning shown', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<AvatarCreateForm />);

    const tradeOption = await screen.findByRole('radio', { name: 'Trade' });

    expect(tradeOption).toBeChecked();
    expect(screen.queryByText(/Self-Found is permanent/)).not.toBeInTheDocument();
  });
});

test('it shows a permanence warning when Self-Found is selected', async () => {
  const user = userEvent.setup();

  await withRequestContext({}, async () => {
    renderWithRouter(<AvatarCreateForm />);

    const selfFoundOption = await screen.findByRole('radio', { name: 'Self-Found' });

    await user.click(selfFoundOption);

    expect(selfFoundOption).toBeChecked();
    expect(screen.getByText(/Self-Found is permanent/)).toBeInTheDocument();
  });
});
