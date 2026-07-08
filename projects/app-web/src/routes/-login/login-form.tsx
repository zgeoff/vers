import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Brand, CheckboxField, Field, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import { HoneypotInputs } from '../../lib/auth/honeypot-inputs';
import { login } from './login';
import type { LoginResult } from './types';

interface LoginFormProps {
  readonly redirectTo?: string | undefined;
}

const pageInfo = css({ marginBottom: '8', textAlign: 'center' });

const formStyles = css({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '6',
  width: '96',
});

const submitButton = css({ marginBottom: '2' });

/** The login page's client-interactive form: submits to the login server function and renders its result. */
export function LoginForm(props: LoginFormProps) {
  const loginFn = useServerFn(login);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'email' | 'password', string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (form: HTMLFormElement) => {
    const formData = new FormData(form);

    setIsPending(true);
    setFormError(null);
    setFieldErrors({});

    try {
      // a successful or 2FA/force-logout-bound submission ends in a redirect that useServerFn
      // already navigated to, resolving this call with no value — there's no further UI to show
      const result: LoginResult | Response | undefined = await loginFn({ data: formData });

      if (result === undefined) {
        return;
      }

      if (result instanceof Response) {
        setFormError('Something went wrong. Please try again.');

        return;
      }

      if (result.status === 'invalid-fields') {
        setFieldErrors(result.fieldErrors);

        return;
      }

      setFormError('Invalid email or password');
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
        <Heading level={2}>Welcome back</Heading>
        <Text>Please enter your details to login</Text>
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
            id: 'email',
            name: 'email',
            placeholder: 'your.email@example.com',
            type: 'email',
          }}
          labelProps={{ children: 'Email', htmlFor: 'email' }}
        />
        <Field
          errors={fieldErrors.password === undefined ? [] : [fieldErrors.password]}
          inputProps={{
            autoComplete: 'current-password',
            id: 'password',
            name: 'password',
            placeholder: '********',
            type: 'password',
          }}
          labelProps={{ children: 'Password', htmlFor: 'password' }}
        />
        {props.redirectTo !== undefined && (
          <input name="redirectTo" type="hidden" value={props.redirectTo} />
        )}
        <CheckboxField
          checkboxProps={{ id: 'rememberMe', name: 'rememberMe' }}
          errors={[]}
          labelProps={{ children: 'Remember me', htmlFor: 'rememberMe' }}
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
          Login
        </StatusButton>
      </form>
    </>
  );
}
