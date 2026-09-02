import { useServerFn } from '@tanstack/react-start';
import type { SecureAction } from '@vers/contract-session';
import { OTPField, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import { verifyStepUp } from '../lib/auth/verify-step-up';

interface StepUpChallengeFormProps {
  readonly action: SecureAction;
  readonly onVerified: (token: string) => void;
  readonly target: string;
  readonly transactionID: string;
}

const formStyles = css({ display: 'flex', flexDirection: 'column', gap: '4' });

export function StepUpChallengeForm(props: StepUpChallengeFormProps) {
  const verifyStepUpFn = useServerFn(verifyStepUp);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (form: HTMLFormElement) => {
    const rawCode = new FormData(form).get('code');

    const code = typeof rawCode === 'string' ? rawCode : '';

    setIsPending(true);
    setFormError(null);

    try {
      const result = await verifyStepUpFn({
        data: {
          action: props.action,
          code,
          target: props.target,
          transactionID: props.transactionID,
        },
      });

      if (result === undefined) {
        return;
      }

      if (result.status === 'invalid-code') {
        const message =
          result.attemptsRemaining > 0
            ? `Invalid code. ${result.attemptsRemaining} attempt(s) remaining.`
            : 'Invalid code. Please start over.';

        setFormError(message);

        return;
      }

      props.onVerified(result.token);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form
      className={formStyles}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit(event.currentTarget);
      }}
    >
      <Text>Enter the six digit code from your authenticator app to continue.</Text>
      <OTPField
        errors={formError === null ? [] : [formError]}
        inputProps={{
          autoComplete: 'one-time-code',
          autoFocus: true,
          id: 'step-up-code',
          mode: 'numeric',
          name: 'code',
        }}
      />
      <StatusButton
        disabled={isPending}
        status={isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
        type="submit"
        variant="primary"
        fullWidth
      >
        Verify
      </StatusButton>
    </form>
  );
}
