import { getFormProps, useForm } from '@conform-to/react';
import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Brand, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import type { FormAction } from '../../lib/forms/types';
import { useFormSubmit } from '../../lib/forms/use-form-submit';
import { forceLogout } from './force-logout';

type PendingIntent = 'cancel' | 'confirm' | null;

interface ForceLogoutFormProps {
  readonly action?: FormAction;
}

const pageInfo = css({ marginBottom: '4', textAlign: 'center' });
const infoText = css({ marginBottom: '6' });

const buttonContainer = css({
  alignItems: 'center',
  display: 'flex',
  gap: '4',
  justifyContent: 'center',
  marginBottom: '2',
  width: '96',
});

/**
 * The force-logout page's confirm/cancel choice; both intents end the request in a redirect.
 */
export function ForceLogoutForm(props: ForceLogoutFormProps) {
  const forceLogoutFn = useServerFn(forceLogout);
  const submission = useFormSubmit(props.action ?? forceLogoutFn);
  const [form] = useForm({ id: 'force-logout-form', onSubmit: submission.onSubmit });
  const [pendingIntent, setPendingIntent] = useState<PendingIntent>(null);

  return (
    <>
      <section className={pageInfo}>
        <Link to="/">
          <Brand size="xl" />
        </Link>
        <Heading level={2}>You are logged in elsewhere</Heading>
        <Text className={infoText}>
          Logging in here picks your run up from the last activity you&rsquo;d started. Any progress
          the other device made offline and hasn&rsquo;t synced yet may be lost.
        </Text>
        <Text>Would you like to log out your other session?</Text>
      </section>

      <form {...getFormProps(form)} className={buttonContainer} method="post">
        <StatusButton
          disabled={submission.isPending}
          name="intent"
          onClick={() => {
            setPendingIntent('confirm');
          }}
          status={
            pendingIntent === 'confirm' && submission.isPending
              ? StatusButton.Status.Pending
              : StatusButton.Status.Idle
          }
          type="submit"
          value="confirm"
          variant="primary"
          fullWidth
        >
          Confirm
        </StatusButton>
        <StatusButton
          disabled={submission.isPending}
          name="intent"
          onClick={() => {
            setPendingIntent('cancel');
          }}
          status={
            pendingIntent === 'cancel' && submission.isPending
              ? StatusButton.Status.Pending
              : StatusButton.Status.Idle
          }
          type="submit"
          value="cancel"
          variant="secondary"
          fullWidth
        >
          Cancel
        </StatusButton>
      </form>
    </>
  );
}
