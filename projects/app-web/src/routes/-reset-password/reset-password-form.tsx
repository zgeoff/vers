import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Brand, Field, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import { HoneypotInputs } from '../../lib/auth/honeypot-inputs';
import { resetPassword } from './reset-password';
import type { ResetPasswordResult } from './reset-password-result';

interface ResetPasswordFormProps {
  readonly email: string;
  readonly resetToken: string;
}

const pageInfo = css({ marginBottom: '8', textAlign: 'center' });

const formStyles = css({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '6',
  width: '96',
});

/** The reset-password page's client-interactive form: submits to the reset-password server function. */
export function ResetPasswordForm(props: ResetPasswordFormProps) {
  const resetPasswordFn = useServerFn(resetPassword);
  const [fieldErrors, setFieldErrors] = useState<ResetPasswordResult['fieldErrors']>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (form: HTMLFormElement) => {
    const formData = new FormData(form);

    setIsPending(true);
    setFormError(null);
    setFieldErrors({});

    try {
      // a successful reset ends in a redirect that useServerFn already navigated to, resolving
      // this call with no value — there's no further UI to show
      const result: ResetPasswordResult | Response | undefined = await resetPasswordFn({
        data: formData,
      });

      if (result === undefined) {
        return;
      }

      if (result instanceof Response) {
        setFormError('Something went wrong. Please try again.');

        return;
      }

      setFieldErrors(result.fieldErrors);
      setFormError(result.formError ?? null);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <section className={pageInfo}>
        <Link to="/">
          <Brand size="xl" />
        </Link>
        <Heading level={2}>Reset your password</Heading>
        <Text>Please enter your new password</Text>
      </section>
      <form
        className={formStyles}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(event.currentTarget);
        }}
      >
        <HoneypotInputs />
        <input name="email" type="hidden" value={props.email} />
        <input name="resetToken" type="hidden" value={props.resetToken} />
        <Field
          errors={fieldErrors.password === undefined ? [] : [fieldErrors.password]}
          inputProps={{
            autoComplete: 'new-password',
            autoFocus: true,
            id: 'password',
            name: 'password',
            placeholder: '********',
            type: 'password',
          }}
          labelProps={{ children: 'New Password', htmlFor: 'password' }}
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
          labelProps={{ children: 'Confirm Password', htmlFor: 'confirmPassword' }}
        />
        {formError !== null && <Text role="alert">{formError}</Text>}
        <StatusButton
          disabled={isPending}
          status={isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
          type="submit"
          variant="primary"
          fullWidth
        >
          Reset Password
        </StatusButton>
      </form>
      <Text>Remember your password?</Text>
      <Link to="/login">Login</Link>
    </>
  );
}
