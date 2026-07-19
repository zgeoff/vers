import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { AccountScreen } from './account-screen';

test('it renders the account content and sub-flow links', async () => {
  renderWithRouter(<AccountScreen Content={<p>account body</p>} has2FA={false} />);

  const body = await screen.findByText('account body');

  expect(body).toBeInTheDocument();

  expect(screen.getByRole('link', { name: /Change email/ })).toHaveAttribute(
    'href',
    '/account/change-email',
  );

  expect(screen.getByRole('link', { name: /Change password/ })).toHaveAttribute(
    'href',
    '/account/change-password',
  );
});

test('it offers to enable 2FA when the account has none', async () => {
  renderWithRouter(<AccountScreen Content={<p>account body</p>} has2FA={false} />);

  const enableLink = await screen.findByRole('link', { name: /Enable 2FA/ });

  expect(enableLink).toHaveAttribute('href', '/account/2fa/verify');
});

test('it offers to disable 2FA when the account has it', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<AccountScreen Content={<p>account body</p>} has2FA />);

    const disableButton = await screen.findByRole('button', { name: 'Disable 2FA' });

    expect(disableButton).toBeInTheDocument();
  });
});
