import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import type { SubmissionResult } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4';
import { Link, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import type { VerificationType } from '@vers/contract-verification';
import { Brand, Heading, OTPField, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useEffect, useRef } from 'react';
import { HoneypotInputs } from '../../lib/auth/honeypot-inputs';
import type { FormAction } from '../../lib/forms/types';
import { useFormSubmit } from '../../lib/forms/use-form-submit';
import { verifyOTP } from './verify-otp';
import { VerifyOTPFormSchema } from './verify-otp-form-schema';

interface VerifyOTPFormProps {
  readonly action?: FormAction;
  readonly code?: string | undefined;
  readonly honeypotValidFrom: string;
  readonly lastResult?: SubmissionResult;
  readonly redirectTo?: string | undefined;
  readonly target: string;
  readonly type: VerificationType;
}

const HEADING_BY_TYPE: Record<VerificationType, string> = {
  '2fa': 'Two-factor authentication',
  '2fa-setup': 'Two-factor authentication',
  'change-email': 'Check your email',
  onboarding: 'Check your email',
};

const INSTRUCTION_BY_TYPE: Record<VerificationType, string> = {
  '2fa': 'To log in, please enter the six digit code from your authenticator app',
  '2fa-setup':
    'To enable two-factor authentication, please enter the six digit code from your authenticator app',
  'change-email':
    "To confirm your new email address, please enter the six digit code we've sent to your email",
  onboarding:
    "To complete your account creation, please enter the six digit code we've sent to your email",
};

const OTP_INPUT_MODE_BY_TYPE: Record<VerificationType, 'alphanumeric' | 'numeric'> = {
  '2fa': 'numeric',
  '2fa-setup': 'numeric',
  'change-email': 'alphanumeric',
  onboarding: 'alphanumeric',
};

const pageInfo = css({ marginBottom: '8', textAlign: 'center' });

const formStyles = css({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '6',
  width: '96',
});

const otpField = css({ marginBottom: '6' });

/**
 * The verify-otp page's client-interactive form: submits the code and renders the result.
 */
export function VerifyOTPForm(props: VerifyOTPFormProps) {
  const router = useRouter();
  const verifyOTPFn = useServerFn(verifyOTP);
  const submission = useFormSubmit(props.action ?? verifyOTPFn, props.lastResult);
  const formRef = useRef<HTMLFormElement>(null);
  const hasAutoSubmitted = useRef(false);

  const [form, fields] = useForm({
    constraint: getZodConstraint(VerifyOTPFormSchema),
    defaultValue: { code: props.code },
    id: 'verify-otp-form',
    lastResult: submission.lastResult,
    onSubmit: submission.onSubmit,
    onValidate(context) {
      return parseWithZod(context.formData, { schema: VerifyOTPFormSchema });
    },
  });

  useEffect(() => {
    // only a change-email verify replies with a success result instead of a server-issued
    // redirect — every other type has already navigated away by the time this could run
    if (props.type !== 'change-email' || submission.lastResult?.status !== 'success') {
      return;
    }

    const runAccountNavigation = async (): Promise<void> => {
      await router.invalidate();
      await router.navigate({ to: '/settings' });
    };

    void runAccountNavigation();
  }, [props.type, router, submission.lastResult]);

  useEffect(() => {
    // a code carried by the emailed link submits at most once — a rejected code must land on the
    // error state and wait for the user to retype rather than resubmit itself in a loop
    if (hasAutoSubmitted.current || props.code === undefined || props.code.length !== 6) {
      return;
    }

    hasAutoSubmitted.current = true;

    const submitButton = formRef.current?.querySelector<HTMLButtonElement>('button[type="submit"]');

    formRef.current?.requestSubmit(submitButton);
  }, [props.code]);

  const { key: _codeKey, ...codeProps } = getInputProps(fields.code, { type: 'text' });
  const codeErrors = [...(fields.code.errors ?? []), ...(form.errors ?? [])];

  return (
    <>
      <section className={pageInfo}>
        <Link to="/">
          <Brand size="xl" />
        </Link>
        <Heading level={2}>{HEADING_BY_TYPE[props.type]}</Heading>
        <Text>{INSTRUCTION_BY_TYPE[props.type]}</Text>
      </section>
      <form {...getFormProps(form)} className={formStyles} method="post" ref={formRef}>
        <HoneypotInputs validFrom={props.honeypotValidFrom} />
        <OTPField
          className={otpField}
          errors={codeErrors}
          inputProps={{
            ...codeProps,
            autoComplete: 'one-time-code',
            autoFocus: true,
            mode: OTP_INPUT_MODE_BY_TYPE[props.type],
          }}
        />
        <input name="type" type="hidden" value={props.type} />
        <input name="target" type="hidden" value={props.target} />
        {props.redirectTo !== undefined && (
          <input name="redirect" type="hidden" value={props.redirectTo} />
        )}
        <StatusButton
          disabled={submission.isPending}
          status={submission.isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
          type="submit"
          variant="primary"
          fullWidth
        >
          Verify
        </StatusButton>
      </form>
    </>
  );
}
