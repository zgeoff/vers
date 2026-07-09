import { Link, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import type { VerificationType } from '@vers/contract-verification';
import { Brand, Heading, OTPField, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import { HoneypotInputs } from '../../lib/auth/honeypot-inputs';
import type { VerifyOTPResult } from './types';
import { verifyOTP } from './verify-otp';

interface VerifyOTPFormProps {
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

/** The verify-otp page's client-interactive form: submits the code and renders the result. */
export function VerifyOTPForm(props: VerifyOTPFormProps) {
  const router = useRouter();
  const verifyOTPFn = useServerFn(verifyOTP);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (form: HTMLFormElement) => {
    const formData = new FormData(form);

    setIsPending(true);
    setFormError(null);

    try {
      // 2fa, 2fa-setup, and onboarding verifies end in a redirect that useServerFn already
      // navigated to, resolving this call with no value — there's no further UI to show
      const result: VerifyOTPResult | Response | undefined = await verifyOTPFn({ data: formData });

      if (result === undefined) {
        return;
      }

      if (result instanceof Response) {
        setFormError('Something went wrong. Please try again.');

        return;
      }

      if (result.status === 'change-email-applied') {
        // invalidate so the account hub reloads the just-changed email before navigating to it
        await router.invalidate();
        await router.navigate({ to: '/account' });

        return;
      }

      setFormError(result.formError);
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
        <Heading level={2}>{HEADING_BY_TYPE[props.type]}</Heading>
        <Text>{INSTRUCTION_BY_TYPE[props.type]}</Text>
      </section>
      <form
        className={formStyles}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(event.currentTarget);
        }}
      >
        <HoneypotInputs />
        <OTPField
          className={otpField}
          errors={formError === null ? [] : [formError]}
          inputProps={{
            autoComplete: 'one-time-code',
            autoFocus: true,
            id: 'code',
            mode: OTP_INPUT_MODE_BY_TYPE[props.type],
            name: 'code',
          }}
        />
        <input name="type" type="hidden" value={props.type} />
        <input name="target" type="hidden" value={props.target} />
        {props.redirectTo !== undefined && (
          <input name="redirect" type="hidden" value={props.redirectTo} />
        )}
        <StatusButton
          disabled={isPending}
          status={isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
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
