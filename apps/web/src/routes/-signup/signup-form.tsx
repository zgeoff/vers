import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import type { SubmissionResult } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Brand, Field, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { HoneypotInputs } from '../../lib/auth/honeypot-inputs';
import type { FormAction } from '../../lib/forms/types';
import { useFormSubmit } from '../../lib/forms/use-form-submit';
import { sendAnalyticsEvent } from '../../lib/send-analytics-event';
import { signup } from './signup';
import { SignupFormSchema } from './signup-form-schema';

interface SignupFormProps {
  readonly action?: FormAction;
  readonly lastResult?: SubmissionResult;
}

const pageInfo = css({ marginBottom: '8', textAlign: 'center' });

const formStyles = css({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '6',
  width: '96',
});

const submitButton = css({ marginBottom: '2' });

/**
 * The signup page's client-interactive form: submits to the signup server function.
 */
export function SignupForm(props: SignupFormProps) {
  const signupFn = useServerFn(signup);

  const submission = useFormSubmit(props.action ?? signupFn, props.lastResult, () => {
    sendAnalyticsEvent('signup-complete');
  });

  const [form, fields] = useForm({
    constraint: getZodConstraint(SignupFormSchema),
    id: 'signup-form',
    lastResult: submission.lastResult,
    onSubmit: submission.onSubmit,
    onValidate(context) {
      return parseWithZod(context.formData, { schema: SignupFormSchema });
    },
  });

  const { key: _emailKey, ...emailProps } = getInputProps(fields.email, { type: 'email' });

  return (
    <>
      <section className={pageInfo}>
        <Link to="/">
          <Brand size="xl" />
        </Link>
        <Heading level={2}>Create an account</Heading>
        <Text>Please enter your details to create an account</Text>
      </section>
      <form {...getFormProps(form)} className={formStyles} method="post">
        <HoneypotInputs />
        <Field
          errors={fields.email.errors ?? []}
          inputProps={{
            ...emailProps,
            autoComplete: 'email',
            autoFocus: true,
            placeholder: 'your.email@example.com',
          }}
          labelProps={{ children: 'Email', htmlFor: emailProps.id }}
        />
        {form.errors !== undefined && <Text role="alert">{form.errors[0]}</Text>}
        <StatusButton
          className={submitButton}
          disabled={submission.isPending}
          status={submission.isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
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
