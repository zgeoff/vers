import { css, cx } from '@vers/styled-system/css';
import * as React from 'react';
import type { NavLinkRenderProps } from 'react-router';
import { NavLink as RRNavLink } from 'react-router';

export interface NavLinkProps {
  children: React.ReactNode;
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  className?: ((navLinkProps: NavLinkRenderProps) => string) | string;
  onClick?: () => void;
  to: string;
}

export const link = css({
  _hover: {
    textDecoration: 'none',
  },
});

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function NavLink(props: NavLinkProps) {
  const { className, to, ...restProps } = props;

  const finalClassName =
    typeof className === 'function'
      ? // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
        (navLinkProps: NavLinkRenderProps) => cx(link, className(navLinkProps))
      : cx(link, className);

  return <RRNavLink {...restProps} className={finalClassName} to={to} />;
}
