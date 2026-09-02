import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import type { SubmissionResult } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Brand, CheckboxField, Field, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { HoneypotInputs } from '../../lib/auth/honeypot-inputs';
import type { FormAction } from '../../lib/forms/types';
import { useFormSubmit } from '../../lib/forms/use-form-submit';
import { sendAnalyticsEvent } from '../../lib/send-analytics-event';
import { onboarding } from './onboarding';
import { OnboardingFormSchema } from './onboarding-form-schema';

interface OnboardingFormProps {
  readonly action?: FormAction;
  readonly honeypotValidFrom: string;
  readonly lastResult?: SubmissionResult;
}

const pageInfo = css({ marginBottom: '8', textAlign: 'center' });

const formStyles = css({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '6',
  width: '96',
});

export function OnboardingForm(props: OnboardingFormProps) {
  const onboardingFn = useServerFn(onboarding);

  const submission = useFormSubmit(props.action ?? onboardingFn, props.lastResult, () => {
    sendAnalyticsEvent('onboarding-complete');
  });

  const [form, fields] = useForm({
    constraint: getZodConstraint(OnboardingFormSchema),
    defaultValue: { rememberMe: true },
    id: 'onboarding-form',
    lastResult: submission.lastResult,
    onSubmit: submission.onSubmit,
    onValidate(context) {
      return parseWithZod(context.formData, { schema: OnboardingFormSchema });
    },
  });

  const { key: _usernameKey, ...usernameProps } = getInputProps(fields.username, { type: 'text' });
  const { key: _nameKey, ...nameProps } = getInputProps(fields.name, { type: 'text' });

  const { key: _passwordKey, ...passwordProps } = getInputProps(fields.password, {
    type: 'password',
  });

  const { key: _confirmPasswordKey, ...confirmPasswordProps } = getInputProps(
    fields.confirmPassword,
    { type: 'password' },
  );

  const { key: _agreeToTermsKey, ...agreeToTermsProps } = getInputProps(fields.agreeToTerms, {
    type: 'checkbox',
  });

  const { key: _rememberMeKey, ...rememberMeProps } = getInputProps(fields.rememberMe, {
    type: 'checkbox',
  });

  return (
    <>
      <section className={pageInfo}>
        <Link to="/">
          <Brand size="xl" />
        </Link>
        <Heading level={2}>Welcome to vers</Heading>
        <Text>Please enter your details to create an account</Text>
      </section>
      <form {...getFormProps(form)} className={formStyles} method="post">
        <HoneypotInputs validFrom={props.honeypotValidFrom} />
        <Field
          errors={fields.username.errors ?? []}
          inputProps={{
            ...usernameProps,
            autoComplete: 'username',
            autoFocus: true,
            placeholder: 'john_smith13',
          }}
          labelProps={{ children: 'Username', htmlFor: usernameProps.id }}
        />
        <Field
          errors={fields.name.errors ?? []}
          inputProps={{ ...nameProps, autoComplete: 'name', placeholder: 'John Smith' }}
          labelProps={{ children: 'Name', htmlFor: nameProps.id }}
        />
        <Field
          errors={fields.password.errors ?? []}
          inputProps={{
            ...passwordProps,
            autoComplete: 'new-password',
            placeholder: '********',
          }}
          labelProps={{ children: 'Password', htmlFor: passwordProps.id }}
        />
        <Field
          errors={fields.confirmPassword.errors ?? []}
          inputProps={{
            ...confirmPasswordProps,
            autoComplete: 'new-password',
            placeholder: '********',
          }}
          labelProps={{ children: 'Confirm Password', htmlFor: confirmPasswordProps.id }}
        />
        <CheckboxField
          checkboxProps={{ ...agreeToTermsProps }}
          errors={fields.agreeToTerms.errors ?? []}
          labelProps={{ children: 'Agree to terms', htmlFor: agreeToTermsProps.id }}
        />
        <CheckboxField
          checkboxProps={{ ...rememberMeProps }}
          errors={fields.rememberMe.errors ?? []}
          labelProps={{ children: 'Remember me', htmlFor: rememberMeProps.id }}
        />
        {form.errors !== undefined && <Text role="alert">{form.errors[0]}</Text>}
        <StatusButton
          disabled={submission.isPending}
          status={submission.isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
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
