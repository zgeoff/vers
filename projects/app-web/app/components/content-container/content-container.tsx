import { cx } from '@vers/styled-system/css';
import * as React from 'react';
import * as styles from './content-container.styles';

interface Props {
  children: React.ReactNode;
  className?: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function ContentContainer(props: Props) {
  const { className, ...restProps } = props;

  return (
    <div className={cx(styles.container, className)} {...restProps}>
      {props.children}
    </div>
  );
}
