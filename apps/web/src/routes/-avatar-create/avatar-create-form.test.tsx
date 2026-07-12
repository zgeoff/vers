import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
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
