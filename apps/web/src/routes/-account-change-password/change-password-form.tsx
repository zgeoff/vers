import { useServerFn } from '@tanstack/react-start';
import { Field, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import { StepUpChallengeForm } from '../../components/step-up-challenge-form';
import { changePassword } from './change-password';
import type { ChangePasswordResult } from './types';

interface StepUpChallenge {
  readonly target: string;
  readonly transactionID: string;
}

type ChangePasswordFieldErrors = Extract<
  ChangePasswordResult,
  { status: 'invalid-fields' }
>['fieldErrors'];

const formStyles = css({ display: 'flex', flexDirection: 'column', gap: '4', width: '96' });

export function ChangePasswordForm() {
  const changePasswordFn = useServerFn(changePassword);
  const [fieldErrors, setFieldErrors] = useState<ChangePasswordFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const [stepUpChallenge, setStepUpChallenge] = useState<StepUpChallenge | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setIsPending(true);
    setFieldErrors({});
    setFormError(null);

    try {
      // a cleared step-up gate followed by a successful change ends in a redirect that
      // useServerFn already navigated to, resolving this call with no value
      const result: ChangePasswordResult | undefined = await changePasswordFn({ data: formData });

      if (result === undefined) {
        return;
      }

      if (result.status === 'invalid-fields') {
        setFieldErrors(result.fieldErrors);

        return;
      }

      if (result.status === 'invalid-credentials') {
        setFormError(result.formError);

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
        action="ChangePassword"
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
          void handleSubmit(resubmission);
        }}
      />
    );
  }

  return (
    <>
      <Heading level={2}>Change your password</Heading>
      <Text>
        To change your password, enter your current password and then your new password twice.
      </Text>
      <form
        className={formStyles}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(new FormData(event.currentTarget));
        }}
      >
        <Field
          errors={fieldErrors.currentPassword === undefined ? [] : [fieldErrors.currentPassword]}
          inputProps={{
            autoComplete: 'current-password',
            autoFocus: true,
            id: 'currentPassword',
            name: 'currentPassword',
            placeholder: '********',
            type: 'password',
          }}
          labelProps={{ children: 'Current password', htmlFor: 'currentPassword' }}
        />
        <Field
          errors={fieldErrors.password === undefined ? [] : [fieldErrors.password]}
          inputProps={{
            autoComplete: 'new-password',
            id: 'password',
            name: 'password',
            placeholder: '********',
            type: 'password',
          }}
          labelProps={{ children: 'New password', htmlFor: 'password' }}
        />
        <Field
          errors={fieldErrors.confirmPassword === undefined ? [] : [fieldErrors.confirmPassword]}
          inputProps={{
            autoComplete: 'new-password',
            id: 'confirmPassword',
            name: 'confirmPassword',
            placeholder: '********',
            type: 'password',
          }}
          labelProps={{ children: 'Confirm new password', htmlFor: 'confirmPassword' }}
        />
        {formError !== null && <Text role="alert">{formError}</Text>}
        <StatusButton
          disabled={isPending}
          status={isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
          type="submit"
          variant="primary"
          fullWidth
        >
          Change password
        </StatusButton>
      </form>
    </>
  );
}
