import { useServerFn } from '@tanstack/react-start';
import { Heading, OTPField, SingleLineCode, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import type { TwoFactorSetupData } from './load-two-factor-setup';
import type { VerifyTwoFactorSetupResult } from './types';
import { verifyTwoFactorSetup } from './verify-two-factor-setup';

const sectionStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  marginBottom: '6',
});

const formStyles = css({ display: 'flex', flexDirection: 'column', gap: '4', width: '96' });
const qrCodeStyles = css({ height: '48', width: '48' });

/**
 * The enable-2FA client island: renders the pending setup's QR code and manual entry code, then
 * submits the confirming TOTP code to finish enabling it.
 */
export function TwoFactorSetupForm(props: TwoFactorSetupData) {
  const verifyTwoFactorSetupFn = useServerFn(verifyTwoFactorSetup);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (form: HTMLFormElement) => {
    setIsPending(true);
    setFormError(null);

    try {
      // a successful verify ends in a redirect that useServerFn already navigated to, resolving
      // this call with no value — there's no further UI to show
      const result: VerifyTwoFactorSetupResult | undefined = await verifyTwoFactorSetupFn({
        data: new FormData(form),
      });

      if (result !== undefined) {
        setFormError(result.formError);
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <Heading level={2}>Enable two-factor authentication</Heading>
      <section className={sectionStyles}>
        <Text bold>Scan this QR code with your authenticator app.</Text>
        <Text>
          Once you enable 2FA, you will need to enter a code from your authenticator app every time
          you log in or perform a security-sensitive action. Do not lose access to your
          authenticator app, or you will lose access to your account.
        </Text>
        <img alt="QR code for 2FA setup" className={qrCodeStyles} src={props.qrCodeDataURL} />
      </section>
      <section className={sectionStyles}>
        <Text>
          If you cannot scan the QR code, add this account to your authenticator app manually using
          this code:
        </Text>
        <SingleLineCode>{props.otpURI}</SingleLineCode>
      </section>
      <form
        className={formStyles}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(event.currentTarget);
        }}
      >
        <Text>Enter the code from your authenticator app to finish enabling 2FA.</Text>
        <OTPField
          errors={formError === null ? [] : [formError]}
          inputProps={{
            autoComplete: 'one-time-code',
            autoFocus: true,
            id: 'code',
            mode: 'numeric',
            name: 'code',
          }}
        />
        <input name="target" type="hidden" value={props.target} />
        <StatusButton
          disabled={isPending}
          status={isPending ? StatusButton.Status.Pending : StatusButton.Status.Idle}
          type="submit"
          variant="primary"
          fullWidth
        >
          Enable 2FA
        </StatusButton>
      </form>
    </>
  );
}
