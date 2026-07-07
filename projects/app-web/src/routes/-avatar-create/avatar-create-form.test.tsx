import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithRouter } from '../../../test-utils/render-with-router';
import { withRequestContext } from '../../../test-utils/with-request-context';
import { AvatarCreateForm } from './avatar-create-form';

/**
 * `avatar-create-handler.test.ts` drives every `AvatarCreateResult` branch against the handler
 * body directly — a plain result object never round-trips through an uncompiled `createServerFn`
 * export under `bun test`, so this file is limited to the initial render and the class-selection
 * island's own client-side state.
 */
test('it renders the class options and name field', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(<AvatarCreateForm />);

    const bruteOption = await screen.findByRole('radio', { name: 'Brute' });

    expect(bruteOption).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Scoundrel' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Scholar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Avatar' })).toBeInTheDocument();
  });
});

test('it fills the hidden class input from the selected class', async () => {
  const user = userEvent.setup();

  await withRequestContext({}, async () => {
    renderWithRouter(<AvatarCreateForm />);

    const scoundrelOption = await screen.findByRole('radio', { name: 'Scoundrel' });

    await user.click(scoundrelOption);

    const classInput = document.querySelector<HTMLInputElement>('input[name="class"]');

    expect(classInput?.value).toBe('scoundrel');
  });
});
