import type { PolymorphicComponentProps } from '@vers/design-system';
import { css, cx } from '@vers/styled-system/css';
import * as React from 'react';
import { Link as RRLink } from 'react-router';

export interface LinkProps<C extends React.ElementType = typeof RRLink> {
  as?: C;
  children: React.ReactNode;
  to: string;
}

export const link = css({
  _hover: {
    textDecoration: 'underline',
  },
  color: 'sky.500',
});

export function Link<T extends React.ElementType = typeof RRLink>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  props: PolymorphicComponentProps<T, LinkProps>,
) {
  const { as, className, ...restProps } = props;

  const Element = as ?? RRLink;

  return <Element {...restProps} className={cx(link, className)} />;
}
