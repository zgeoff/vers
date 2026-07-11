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
import { login } from './login';
import { LoginFormSchema } from './login-form-schema';

interface LoginFormProps {
  readonly action?: FormAction;
  readonly lastResult?: SubmissionResult;
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

/**
 * The login page's client-interactive form: submits to the login server function and renders its result.
 */
export function LoginForm(props: LoginFormProps) {
  const loginFn = useServerFn(login);
  const submission = useFormSubmit(props.action ?? loginFn, props.lastResult);

  const [form, fields] = useForm({
    constraint: getZodConstraint(LoginFormSchema),
    id: 'login-form',
    lastResult: submission.lastResult,
    onSubmit: submission.onSubmit,
    onValidate(context) {
      return parseWithZod(context.formData, { schema: LoginFormSchema });
    },
  });

  const { key: _emailKey, ...emailProps } = getInputProps(fields.email, { type: 'email' });

  const { key: _passwordKey, ...passwordProps } = getInputProps(fields.password, {
    type: 'password',
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
        <Heading level={2}>Welcome back</Heading>
        <Text>Please enter your details to login</Text>
      </section>
      <form {...getFormProps(form)} className={formStyles}>
        <HoneypotInputs />
        <Field
          errors={fields.email.errors ?? []}
          inputProps={{
            ...emailProps,
            autoComplete: 'email',
            placeholder: 'your.email@example.com',
          }}
          labelProps={{ children: 'Email', htmlFor: emailProps.id }}
        />
        <Field
          errors={fields.password.errors ?? []}
          inputProps={{
            ...passwordProps,
            autoComplete: 'current-password',
            placeholder: '********',
          }}
          labelProps={{ children: 'Password', htmlFor: passwordProps.id }}
        />
        {props.redirectTo !== undefined && (
          <input name="redirectTo" type="hidden" value={props.redirectTo} />
        )}
        <CheckboxField
          checkboxProps={{ ...rememberMeProps }}
          errors={fields.rememberMe.errors ?? []}
          labelProps={{ children: 'Remember me', htmlFor: rememberMeProps.id }}
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
          Login
        </StatusButton>
      </form>
      <Text>Don&apos;t have an account?</Text>
      <Link to="/signup">Create an account</Link>
      <Link to="/forgot-password">Forgot password?</Link>
    </>
  );
}
