import { css, cva } from '@vers/styled-system/css';

export const brand = css({
  display: 'block',
  fontSize: 'md',
  height: '14',
  hideBelow: 'md',
  marginBottom: '4',
  paddingTop: '4',
  paddingX: '6',
});

export const navOverlay = cva({
  base: {
    backgroundColor: 'neutral.950/50',
    bottom: '0',
    left: '0',
    opacity: '[0]',
    pointerEvents: 'none',
    position: 'fixed',
    right: '0',
    top: '0',
    transition: {
      base: 'opacity',
      md: '[none]',
    },
    transitionDuration: 'normal',
    transitionTimingFunction: 'in-out',
    zIndex: '[4]',
  },
  variants: {
    isVisible: {
      true: {
        base: {
          opacity: '[1]',
          pointerEvents: 'all',
        },
        md: {
          opacity: '[0]',
          pointerEvents: 'none',
        },
      },
    },
  },
});

export const nav = css({
  _scrollbar: {
    width: '2',
  },
  _scrollbarThumb: {
    backgroundColor: 'gray.700',
  },
  _scrollbarTrack: {
    backgroundColor: 'neutral.950/50',
  },
  backgroundColor: 'gray.900',
  display: 'flex',
  flexDirection: 'column',
  height: 'full',
  left: '0',
  maxWidth: '72',
  minWidth: '56',
  overflowY: 'auto',
  paddingBottom: '6',
  paddingTop: {
    // header height + padding
    base: '[calc(56px + 16px)]',
    md: '0',
  },
  position: {
    base: 'fixed',
    md: 'relative',
  },
  top: '0',
  transition: {
    base: 'transform',
    md: '[none]',
  },
  transitionDuration: 'normal',
  transitionTimingFunction: 'in-out',
  width: '1/5',
  zIndex: '[5]',
});

export const navHidden = css({
  transform: {
    base: 'translateX(-100%)',
    md: 'none',
  },
});

export const navSection = css({
  display: 'flex',
  flexDirection: 'column',
});

export const navSectionTitle = css({
  color: 'gray.400',
  fontFamily: 'display',
  fontSize: 'xs',
  marginX: '6',
  paddingY: '2',
});

export const navList = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  marginBottom: '2',
});

export const navListItem = css({
  //
});

export const navLink = cva({
  base: {
    _active: {
      transform: 'scale(0.98)',
    },
    _hover: {
      backgroundColor: 'gray.950/40',
      textDecoration: 'none',
    },
    alignItems: 'center',
    color: 'gray.200',
    display: 'flex',
    fontSize: 'sm',
    fontWeight: 'medium',
    marginX: '2',
    paddingLeft: '4',
    paddingY: '2',
    rounded: 'md',
    transition: 'background',
    transitionDuration: 'fast',
    transitionTimingFunction: 'in-out',
  },
  variants: {
    isActive: {
      true: {
        _hover: {
          backgroundColor: 'gray.800/70',
          textDecoration: 'none',
        },
        backgroundColor: 'gray.800/70',
      },
    },
    isDisabled: {
      true: {
        cursor: '[default]',
        opacity: '[0.3]',
        pointerEvents: 'none',
      },
    },
  },
});

export const navLinkIcon = css({
  height: '6',
  marginRight: '2',
  width: '6',
});
