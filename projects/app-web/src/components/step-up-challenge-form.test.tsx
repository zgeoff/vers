import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '../test-utils/render-with-router';
import { withRequestContext } from '../test-utils/with-request-context';
import { StepUpChallengeForm } from './step-up-challenge-form';

/**
 * `verify-step-up-handler.test.ts` drives every `VerifyStepUpResult` branch (invalid code with
 * attempts remaining, lockout, a verified token) against the handler body directly. This
 * component's submit never throws a redirect — every outcome is a plain result object — and an
 * uncompiled `createServerFn` export under `bun test` only relays a thrown redirect back to its
 * caller, so no submission branch is observable here; this file is limited to the initial render,
 * with the rest left to the handler-level tests plus the real-runtime smoke suite.
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
