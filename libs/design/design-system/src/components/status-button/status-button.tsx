import { useDebouncedState } from '@react-hookz/web';
import { css, cx } from '@vers/styled-system/css';
import { useEffect, useState } from 'react';
import type { Props as ButtonProps } from '../button/button';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';
import { Spinner } from '../spinner/spinner';

type Props = ButtonProps & {
  spinDelay?: number;
  status: StatusButtonStatus;
};

enum StatusButtonStatus {
  Error = 'error',
  Idle = 'idle',
  Pending = 'pending',
  Success = 'success',
}

const statusIconContainer = css({
  alignItems: 'center',
  backgroundColor: 'bg.panelElevated',
  color: 'text.primary',
  display: 'flex',
  height: '[100%]',
  justifyContent: 'center',
  position: 'absolute',
  transform: 'translateY(-100%)',
  width: '[100%]',
});

const errorStatusButton = css({
  borderColor: 'border.danger !important',
});

const errorStatusIconContainer = css({
  backgroundColor: 'bg.panel',
});

const buttonContent = css({
  alignItems: 'center',
  display: 'block',
  height: '[100%]',
  justifyContent: 'center',
  width: '[100%]',
});

const showStatusIcon = css({
  transform: 'translateY(0)',
});

const hideButtonContent = css({
  transform: 'translateY(200%)',
});

export function StatusButton(props: Readonly<Props>) {
  const { children, ...restProps } = props;

  // we debounce this state so that we can show our success or error states
  // for a short period of time before resetting to idle
  const [isIdle, setIsIdle] = useDebouncedState(true, 300);

  useEffect(() => {
    setIsIdle(restProps.status === StatusButtonStatus.Idle);
  }, [restProps.status, setIsIdle]);

  const [lastNonIdleStatus, setLastNonIdleStatus] = useState<StatusButtonStatus>(
    StatusButtonStatus.Pending,
  );

  // keep track of our last non-idle status so we can make sure we're always
  // displaying an icon even when we return to idle
  if (restProps.status !== StatusButtonStatus.Idle && restProps.status !== lastNonIdleStatus) {
    setLastNonIdleStatus(restProps.status);
  }

  const statusIcon = findStatusIcon(lastNonIdleStatus);
  const isError = lastNonIdleStatus === StatusButtonStatus.Error;

  return (
    <Button {...restProps} className={cx(isError && !isIdle && errorStatusButton, props.className)}>
      <div
        className={cx(
          statusIconContainer,
          !isIdle && showStatusIcon,
          isError && errorStatusIconContainer,
        )}
      >
        {statusIcon}
      </div>
      <div className={cx(buttonContent, !isIdle && hideButtonContent)}>{children}</div>
    </Button>
  );
}

StatusButton.Status = StatusButtonStatus;

function findStatusIcon(status: StatusButtonStatus) {
  if (status === StatusButtonStatus.Pending) {
    return <Spinner size="sm" />;
  }

  if (status === StatusButtonStatus.Success) {
    return (
      <Icon.Checkmark
        aria-hidden="false"
        aria-label="Success"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- inline SVG icon; role="img" + aria-label is the accessible-SVG pattern, an <img> tag needs a src
        role="img"
        size={24}
      />
    );
  }

  if (status === StatusButtonStatus.Error) {
    return (
      <Icon.Alert
        aria-hidden="false"
        aria-label="Error"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- inline SVG icon; role="img" + aria-label is the accessible-SVG pattern, an <img> tag needs a src
        role="img"
        size={32}
      />
    );
  }

  return null;
}
