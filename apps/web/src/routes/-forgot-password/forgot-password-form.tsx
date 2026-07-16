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
import { forgotPassword } from './forgot-password';
import { ForgotPasswordFormSchema } from './forgot-password-form-schema';

interface ForgotPasswordFormProps {
  readonly action?: FormAction;
  readonly lastResult?: SubmissionResult;
}

const pageInfo = css({ marginBottom: '8', textAlign: 'center' });
const formStyles = css({ marginBottom: '6', width: '96' });

/**
 * The forgot-password page's client-interactive form: submits to the forgot-password server function.
 */
export function ForgotPasswordForm(props: ForgotPasswordFormProps) {
  const forgotPasswordFn = useServerFn(forgotPassword);
  const submission = useFormSubmit(props.action ?? forgotPasswordFn, props.lastResult);

  const [form, fields] = useForm({
    constraint: getZodConstraint(ForgotPasswordFormSchema),
    id: 'forgot-password-form',
    lastResult: submission.lastResult,
    onSubmit: submission.onSubmit,
    onValidate(context) {
      return parseWithZod(context.formData, { schema: ForgotPasswordFormSchema });
    },
  });

  const { key: _emailKey, ...emailProps } = getInputProps(fields.email, { type: 'email' });

  return (
    <>
      <section className={pageInfo}>
        <Link to="/">
          <Brand size="xl" />
        </Link>
        <Heading level={2}>Forgot your password?</Heading>
        <Text>No worries, we&apos;ll send you reset instructions to your email address.</Text>
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
          disabled={submission.isPending}
          status={submission.isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
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
