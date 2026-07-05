import { css, cx } from '@vers/styled-system/css';
import * as React from 'react';
import { Icon } from '../icon/icon';

export type Props = React.ComponentProps<'code'>;

const container = css({
  alignItems: 'center',
  backgroundColor: 'neutral.900',
  display: 'flex',
  paddingLeft: '4',
  paddingRight: '7',
  paddingY: '2',
  position: 'relative',
  rounded: 'md',
});

const pre = css({
  overflowX: 'scroll',
  scrollbarWidth: '[none]',
});

const code = css({
  backgroundColor: 'transparent',
  border: 'none',
  color: 'neutral.50',
  fontFamily: 'fira',
});

const copyButton = css({
  _hover: {
    color: 'neutral.200',
    cursor: '[pointer]',
  },
  color: 'neutral.700',
  height: 'full',
  position: 'absolute',
  right: '1',
  top: '[0px]',
  transition: 'colors',
  transitionDuration: 'fast',
  transitionTimingFunction: 'out',
});

export function SingleLineCode(props: Props) {
  const { className, ...rest } = props;

  const codeRef = React.useRef<HTMLElement>(null);

  const copyToClipboard = () => {
    void navigator.clipboard.writeText(codeRef.current?.textContent ?? '');
  };

  return (
    <div className={cx(container, className)}>
      <pre className={pre}>
        <code ref={codeRef} className={code} {...rest} />
      </pre>
      <Icon.Clipboard className={copyButton} onClick={copyToClipboard} />
    </div>
  );
}
