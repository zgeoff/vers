import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../test-utils/render-with-router';
import { withRequestContext } from '../test-utils/with-request-context';
import { StepUpChallengeForm } from './step-up-challenge-form';

/**
 * This form's submit never throws a redirect — every outcome is a plain result object handled
 * inline — so no submission branch round-trips to be observed here, and this file is limited to
 * the initial render.
 */
test('it renders the code entry field and submit button', async () => {
  await withRequestContext({}, async () => {
    renderWithRouter(
      <StepUpChallengeForm
        action="ChangeEmail"
        target="user-1"
        transactionID="transaction-1"
        onVerified={() => {}}
      />,
    );

    const otpInput = await screen.findByTestId('otp-input');

    expect(otpInput).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
  });
});
