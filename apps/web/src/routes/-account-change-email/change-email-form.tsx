import { useServerFn } from '@tanstack/react-start';
import { Field, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import { StepUpChallengeForm } from '../../components/step-up-challenge-form';
import { changeEmail } from './change-email';
import type { ChangeEmailResult } from './types';

interface StepUpChallenge {
  readonly target: string;
  readonly transactionID: string;
}

const formStyles = css({ display: 'flex', flexDirection: 'column', gap: '4', width: '96' });

/**
 * The change-email page's client-interactive form. A `step-up-required` result swaps the form for
 * the shared step-up challenge island; once it verifies, the original submission is resubmitted
 * with the resulting transaction token attached.
 */
export function ChangeEmailForm() {
  const changeEmailFn = useServerFn(changeEmail);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'email', string>>>({});
  const [isPending, setIsPending] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const [stepUpChallenge, setStepUpChallenge] = useState<StepUpChallenge | null>(null);

  const submit = async (formData: FormData) => {
    setIsPending(true);
    setFieldErrors({});

    try {
      // a cleared step-up gate ends in a redirect to verify-otp that useServerFn already
      // navigated to, resolving this call with no value — there's no further UI to show
      const result: ChangeEmailResult | undefined = await changeEmailFn({ data: formData });

      if (result === undefined) {
        return;
      }

      if (result.status === 'invalid-fields') {
        setFieldErrors(result.fieldErrors);

        return;
      }

      setPendingFormData(formData);
      setStepUpChallenge({ target: result.target, transactionID: result.transactionID });
    } finally {
      setIsPending(false);
    }
  };

  if (stepUpChallenge !== null && pendingFormData !== null) {
    return (
      <StepUpChallengeForm
        action="ChangeEmail"
        target={stepUpChallenge.target}
        transactionID={stepUpChallenge.transactionID}
        onVerified={(token) => {
          const resubmission = new FormData();

          for (const [key, value] of pendingFormData.entries()) {
            resubmission.append(key, value);
          }

          resubmission.set('stepUpToken', token);

          setStepUpChallenge(null);
          setPendingFormData(null);
          void submit(resubmission);
        }}
      />
    );
  }

  return (
    <>
      <Heading level={2}>Change your email address</Heading>
      <Text>
        Enter your new email address below. A verification code will be sent there to confirm the
        change.
      </Text>
      <form
        className={formStyles}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        <Field
          errors={fieldErrors.email === undefined ? [] : [fieldErrors.email]}
          inputProps={{
            autoComplete: 'email',
            autoFocus: true,
            id: 'email',
            name: 'email',
            placeholder: 'your.new.email@example.com',
            type: 'email',
          }}
          labelProps={{ children: 'New email address', htmlFor: 'email' }}
        />
        <StatusButton
          disabled={isPending}
          status={isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
          type="submit"
          variant="primary"
          fullWidth
        >
          Change email
        </StatusButton>
      </form>
    </>
  );
}
