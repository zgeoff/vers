import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Brand, Field, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import { HoneypotInputs } from '../../lib/auth/honeypot-inputs';
import { forgotPassword } from './forgot-password';
import type { ForgotPasswordResult } from './forgot-password-result';

const pageInfo = css({ marginBottom: '8', textAlign: 'center' });

const formStyles = css({ marginBottom: '6', width: '96' });

/** The forgot-password page's client-interactive form: submits to the forgot-password server function. */
export function ForgotPasswordForm() {
  const forgotPasswordFn = useServerFn(forgotPassword);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'email', string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (form: HTMLFormElement) => {
    const formData = new FormData(form);

    setIsPending(true);
    setFormError(null);
    setFieldErrors({});

    try {
      // a submission that clears validation ends in a redirect that useServerFn already
      // navigated to, resolving this call with no value — there's no further UI to show
      const result: ForgotPasswordResult | Response | undefined = await forgotPasswordFn({
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
        <Heading level={2}>Forgot your password?</Heading>
        <Text>No worries, we&apos;ll send you reset instructions to your email address.</Text>
      </section>
      <form
        className={formStyles}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(event.currentTarget);
        }}
      >
        <HoneypotInputs />
        <Field
          errors={fieldErrors.email === undefined ? [] : [fieldErrors.email]}
          inputProps={{
            autoComplete: 'email',
            autoFocus: true,
            id: 'email',
            name: 'email',
            placeholder: 'your.email@example.com',
            type: 'email',
          }}
          labelProps={{ children: 'Email', htmlFor: 'email' }}
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
