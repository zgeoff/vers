import { Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Brand, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useState } from 'react';
import { forceLogout } from './force-logout';

type PendingIntent = 'cancel' | 'confirm' | null;

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

/** The force-logout page's confirm/cancel choice; both options end the request in a redirect. */
export function ForceLogoutForm() {
  const forceLogoutFn = useServerFn(forceLogout);
  const [pendingIntent, setPendingIntent] = useState<PendingIntent>(null);

  const submit = async (intent: 'cancel' | 'confirm') => {
    setPendingIntent(intent);

    const formData = new FormData();

    formData.set('intent', intent);

    try {
      await forceLogoutFn({ data: formData });
    } finally {
      setPendingIntent(null);
    }
  };

  return (
    <>
      <section className={pageInfo}>
        <Link to="/">
          <Brand size="xl" />
        </Link>
        <Heading level={2}>You are logged in elsewhere</Heading>
        <Text className={infoText}>
          You are currently logged in somewhere else. To ensure your account can be properly
          synchronized, we need to log you out there, before we can log you in here.
        </Text>
        <Text>Would you like to logout your other sessions?</Text>
      </section>

      <div className={buttonContainer}>
        <StatusButton
          disabled={pendingIntent !== null}
          onClick={() => {
            void submit('confirm');
          }}
          status={
            pendingIntent === 'confirm' ? StatusButton.Status.Pending : StatusButton.Status.Idle
          }
          type="button"
          variant="primary"
          fullWidth
        >
          Confirm
        </StatusButton>
        <StatusButton
          disabled={pendingIntent !== null}
          onClick={() => {
            void submit('cancel');
          }}
          status={
            pendingIntent === 'cancel' ? StatusButton.Status.Pending : StatusButton.Status.Idle
          }
          type="button"
          variant="secondary"
          fullWidth
        >
          Cancel
        </StatusButton>
      </div>
    </>
  );
}
