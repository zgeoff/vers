import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Brand, CheckboxField, Field, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import { HoneypotInputs } from '../../lib/auth/honeypot-inputs';
import { onboarding } from './onboarding';
import type { OnboardingResult } from './types';

const pageInfo = css({ marginBottom: '8', textAlign: 'center' });

const formStyles = css({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '6',
  width: '96',
});

/** The onboarding page's client-interactive form: submits to the onboarding server function. */
export function OnboardingForm() {
  const onboardingFn = useServerFn(onboarding);
  const [fieldErrors, setFieldErrors] = useState<OnboardingResult['fieldErrors']>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (form: HTMLFormElement) => {
    const formData = new FormData(form);

    setIsPending(true);
    setFormError(null);
    setFieldErrors({});

    try {
      // a successful account creation ends in a redirect that useServerFn already navigated to,
      // resolving this call with no value — there's no further UI to show
      const result: OnboardingResult | Response | undefined = await onboardingFn({
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
        <Heading level={2}>Welcome to vers</Heading>
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
          errors={fieldErrors.username === undefined ? [] : [fieldErrors.username]}
          inputProps={{
            autoComplete: 'username',
            autoFocus: true,
            id: 'username',
            name: 'username',
            placeholder: 'john_smith13',
            type: 'text',
          }}
          labelProps={{ children: 'Username', htmlFor: 'username' }}
        />
        <Field
          errors={fieldErrors.name === undefined ? [] : [fieldErrors.name]}
          inputProps={{
            autoComplete: 'name',
            id: 'name',
            name: 'name',
            placeholder: 'John Smith',
            type: 'text',
          }}
          labelProps={{ children: 'Name', htmlFor: 'name' }}
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
          labelProps={{ children: 'Password', htmlFor: 'password' }}
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
        <CheckboxField
          checkboxProps={{ id: 'agreeToTerms', name: 'agreeToTerms' }}
          errors={fieldErrors.agreeToTerms === undefined ? [] : [fieldErrors.agreeToTerms]}
          labelProps={{ children: 'Agree to terms', htmlFor: 'agreeToTerms' }}
        />
        <CheckboxField
          checkboxProps={{ defaultChecked: true, id: 'rememberMe', name: 'rememberMe' }}
          errors={[]}
          labelProps={{ children: 'Remember me', htmlFor: 'rememberMe' }}
        />
        {formError !== null && <Text role="alert">{formError}</Text>}
        <StatusButton
          disabled={isPending}
          status={isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
          type="submit"
          variant="primary"
          fullWidth
        >
          Create an Account
        </StatusButton>
      </form>
    </>
  );
}
