import { useEffect, useState } from 'react';
import { Button } from '../button/button';
import { StatusButton } from './status-button';

export function Default() {
  const success = useEmulateSubmit({ success: true });
  const error = useEmulateSubmit({ success: false });

  return (
    <>
      <StatusButton status={success.status} variant="primary" onClick={success.handleSubmit}>
        Success
      </StatusButton>
      <StatusButton status={error.status} variant="primary" onClick={error.handleSubmit}>
        Error
      </StatusButton>
      <Button
        onClick={() => {
          success.resetStatus();
          error.resetStatus();
        }}
      >
        Reset State
      </Button>
    </>
  );
}

interface EmulateSubmitConfig {
  success: boolean;
}

// hacky hook to give us a simulatedish submit flow that cycles the
// status button states from idle -> pending -> success.
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function useEmulateSubmit(config: EmulateSubmitConfig) {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(StatusButton.Status.Idle);

  const handleSubmit = () => {
    setSubmitting(true);
  };

  const resetStatus = () => {
    setStatus(StatusButton.Status.Idle);
    setSubmitting(false);
  };

  // when we start submitting set the status to pending, and after a
  // 2 second delay, set the status to success
  useEffect(() => {
    if (!submitting) {
      return;
    }

    setStatus(StatusButton.Status.Pending);

    const timeout = setTimeout(() => {
      setSubmitting(false);

      const finalStatus = config.success ? StatusButton.Status.Success : StatusButton.Status.Error;

      setStatus(finalStatus);
    }, 2000);

    // oxlint-disable-next-line typescript/consistent-return, typescript/no-confusing-void-expression -- baseline(#236)
    return () => clearTimeout(timeout);
  }, [submitting, setSubmitting, config.success]);

  return { handleSubmit, resetStatus, status };
}
