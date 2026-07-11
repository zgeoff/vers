import { css, cx } from '@vers/styled-system/css';
import * as React from 'react';
import { Icon } from '../icon/icon';

const container = css({
  alignItems: 'center',
  backgroundColor: 'bg.panel',
  display: 'flex',
  paddingLeft: '4',
  paddingRight: '7',
  paddingY: '2',
  position: 'relative',
});

const pre = css({
  overflowX: 'scroll',
  scrollbarWidth: '[none]',
});

const code = css({
  backgroundColor: 'transparent',
  border: 'none',
  color: 'text.primary',
  fontFamily: 'mono',
});

const copyButton = css({
  _hover: {
    color: 'text.primary',
    cursor: '[pointer]',
  },
  color: 'text.muted',
  height: 'full',
  position: 'absolute',
  right: '1',
  top: '[0px]',
});

export function SingleLineCode(props: React.HTMLAttributes<HTMLElement>) {
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
