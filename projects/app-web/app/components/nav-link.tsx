import * as React from 'react';
import type { NavLinkRenderProps } from 'react-router';
import { NavLink as RRNavLink } from 'react-router';
import { css, cx } from '@vers/styled-system/css';

export interface NavLinkProps {
  children: React.ReactNode;
  className?: ((navLinkProps: NavLinkRenderProps) => string) | string;
  onClick?: () => void;
  to: string;
}

export const link = css({
  _hover: {
    textDecoration: 'none',
  },
});

export function NavLink(props: NavLinkProps) {
  const { className, to, ...restProps } = props;

  const finalClassName =
    typeof className === 'function'
      ? (navLinkProps: NavLinkRenderProps) => cx(link, className(navLinkProps))
      : cx(link, className);

  return <RRNavLink {...restProps} className={finalClassName} to={to} />;
}
