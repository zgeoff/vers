import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Brand, Field, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import { HoneypotInputs } from '../../lib/auth/honeypot-inputs';
import { signup } from './signup';
import type { SignupResult } from './signup-result';

const pageInfo = css({ marginBottom: '8', textAlign: 'center' });

const formStyles = css({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '6',
  width: '96',
});

const submitButton = css({ marginBottom: '2' });

/** The signup page's client-interactive form: submits to the signup server function. */
export function SignupForm() {
  const signupFn = useServerFn(signup);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'email', string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (form: HTMLFormElement) => {
    const formData = new FormData(form);

    setIsPending(true);
    setFormError(null);
    setFieldErrors({});

    try {
      // a submission with no existing account ends in a redirect that useServerFn already
      // navigated to, resolving this call with no value — there's no further UI to show
      const result: Response | SignupResult | undefined = await signupFn({ data: formData });

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
        <Heading level={2}>Create an account</Heading>
        <Text>Please enter your details to create an account</Text>
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
          className={submitButton}
          disabled={isPending}
          status={isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
          type="submit"
          variant="primary"
          fullWidth
        >
          Signup
        </StatusButton>
      </form>
      <Text>Already have an account?</Text>
      <Link to="/login">Login</Link>
    </>
  );
}
