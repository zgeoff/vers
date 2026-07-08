import { useServerFn } from '@tanstack/react-start';
import { StatusButton, Text } from '@vers/design-system';
import { useState } from 'react';
import { StepUpChallengeForm } from '../../components/step-up-challenge-form';
import { disableTwoFactorAuth } from './disable-two-factor-auth';

interface StepUpChallenge {
  readonly target: string;
  readonly transactionID: string;
}

/**
 * The account hub's disable-2FA action. A `step-up-required` result swaps the button for the
 * shared step-up challenge island; once it verifies, the action is resubmitted with the resulting
 * transaction token attached.
 */
export function DisableTwoFactorAuthForm() {
  const disableTwoFactorAuthFn = useServerFn(disableTwoFactorAuth);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [stepUpChallenge, setStepUpChallenge] = useState<StepUpChallenge | null>(null);

  const submit = async (stepUpToken?: string) => {
    setIsPending(true);
    setFormError(null);

    const formData = new FormData();

    if (stepUpToken !== undefined) {
      formData.set('stepUpToken', stepUpToken);
    }

    try {
      // a cleared step-up gate followed by a successful disable ends in a redirect that
      // useServerFn already navigated to, resolving this call with no value
      const result = await disableTwoFactorAuthFn({ data: formData });

      if (result === undefined) {
        return;
      }

      if (result.status === 'error') {
        setFormError(result.formError);

        return;
      }

      setStepUpChallenge({ target: result.target, transactionID: result.transactionID });
    } finally {
      setIsPending(false);
    }
  };

  if (stepUpChallenge !== null) {
    return (
      <StepUpChallengeForm
        action="TwoFactorAuthDisable"
        target={stepUpChallenge.target}
        transactionID={stepUpChallenge.transactionID}
        onVerified={(token) => {
          setStepUpChallenge(null);
          void submit(token);
        }}
      />
    );
  }

  return (
    <>
      <StatusButton
        disabled={isPending}
        onClick={() => void submit()}
        status={isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
        type="button"
      >
        Disable 2FA
      </StatusButton>
      {formError !== null && <Text role="alert">{formError}</Text>}
    </>
  );
}
