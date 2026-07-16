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
import { resetPassword } from './reset-password';
import { ResetPasswordFormSchema } from './reset-password-form-schema';

interface ResetPasswordFormProps {
  readonly action?: FormAction;
  readonly email: string;
  readonly lastResult?: SubmissionResult;
  readonly resetToken: string;
}

const pageInfo = css({ marginBottom: '8', textAlign: 'center' });

const formStyles = css({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '6',
  width: '96',
});

/**
 * The reset-password page's client-interactive form: submits to the reset-password server function.
 */
export function ResetPasswordForm(props: ResetPasswordFormProps) {
  const resetPasswordFn = useServerFn(resetPassword);
  const submission = useFormSubmit(props.action ?? resetPasswordFn, props.lastResult);

  const [form, fields] = useForm({
    constraint: getZodConstraint(ResetPasswordFormSchema),
    id: 'reset-password-form',
    lastResult: submission.lastResult,
    onSubmit: submission.onSubmit,
    onValidate(context) {
      return parseWithZod(context.formData, { schema: ResetPasswordFormSchema });
    },
  });

  const { key: _passwordKey, ...passwordProps } = getInputProps(fields.password, {
    type: 'password',
  });

  const { key: _confirmPasswordKey, ...confirmPasswordProps } = getInputProps(
    fields.confirmPassword,
    { type: 'password' },
  );

  return (
    <>
      <section className={pageInfo}>
        <Link to="/">
          <Brand size="xl" />
        </Link>
        <Heading level={2}>Reset your password</Heading>
        <Text>Please enter your new password</Text>
      </section>
      <form {...getFormProps(form)} className={formStyles} method="post">
        <HoneypotInputs />
        <input name="email" type="hidden" value={props.email} />
        <input name="resetToken" type="hidden" value={props.resetToken} />
        <Field
          errors={fields.password.errors ?? []}
          inputProps={{
            ...passwordProps,
            autoComplete: 'new-password',
            autoFocus: true,
            placeholder: '********',
          }}
          labelProps={{ children: 'New Password', htmlFor: passwordProps.id }}
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
