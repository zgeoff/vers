import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ChangeEmailForm } from './change-email-form';

/**
 * `change-email-handler.test.ts` drives every `ChangeEmailResult` branch (field errors, step-up
 * required, and the change-verification redirect) against the handler body directly — a plain
 * result object never round-trips through an uncompiled `createServerFn` export under `bun test`,
 * so this file is limited to the initial render.
 */
test('it renders the new-email field and submit button', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<ChangeEmailForm />);

    const emailField = await screen.findByLabelText('New email address');

    expect(emailField).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change email' })).toBeInTheDocument();
  });
});
