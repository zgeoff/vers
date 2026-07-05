import { css } from '@vers/styled-system/css';

export const container = css({
  _active: {
    transform: 'scale(0.99)',
  },
  _before: {
    borderGradient: 'sky.500',
    borderWidth: '[1px]',
    content: '""',
    inset: '0',
    opacity: '[0]',
    pointerEvents: 'none',
    position: 'absolute',
    rounded: 'md',
    transition: 'opacity',
    transitionDuration: 'fast',
    transitionTimingFunction: 'in-out',
    zIndex: '[3]',
  },
  _hover: {
    filter: '[grayscale(0)]',
  },
  backgroundColor: 'gray.900',
  backgroundGradient: 'to-b',
  borderColor: 'gray.700',
  borderWidth: '[1px]',
  boxShadow: 'lg',
  filter: '[grayscale(0.8)]',
  flex: '1',
  gradientFrom: 'gray.950',
  gradientTo: 'transparent',
  outlineColor: 'sky.500',
  overflow: 'hidden',
  position: 'relative',
  rounded: 'md',
  transition: '[filter, transform]',
  transitionDuration: 'fast',
  transitionTimingFunction: 'in',
  userSelect: 'none',
});

export const selected = css({
  _before: {
    opacity: '[1]',
  },
  filter: '[grayscale(0)]',
});

export const backgroundPattern = css({
  height: 'full',
  inset: '0',
  opacity: '[0.2]',
  position: 'absolute',
  stroke: 'gray.800',
  zIndex: '[0]',
});

export const image = css({
  pointerEvents: 'none',
  position: 'relative',
  zIndex: '[1]',
});

export const contentContainer = css({
  backgroundColor: 'gray.950/90',
  backgroundGradient: 'to-b',
  bottom: '0',
  gradientFrom: 'gray.950',
  gradientTo: 'gray.950/30',
  height: {
    base: 'auto',
    lg: '48',
    xl: '44',
  },
  position: 'absolute',
  roundedBottom: 'md',
  width: 'full',
  zIndex: '[2]',
});

export const header = css({
  backgroundGradient: 'to-r',
  borderBottomWidth: '[1px]',
  borderGradient: 'sky.500',
  borderTopWidth: '[1px]',
  gradientFrom: 'sky.700',
  gradientTo: 'transparent',
  gradientToPosition: '80%',
  overflow: 'hidden',
  paddingX: '4',
  paddingY: '1',
  position: 'relative',
});

export const headerBackgroundPattern = css({
  left: '0',
  opacity: '[0.1]',
  position: 'absolute',
  stroke: 'sky.500',
  top: '0',
  zIndex: '[5]',
});

export const flavourTextContainer = css({
  display: {
    base: 'none',
    lg: 'block',
  },
  paddingX: '4',
  paddingY: '2',
});

export const name = css({
  color: 'gray.100',
  fontFamily: 'display',
  fontSize: {
    base: 'lg',
    xl: 'xl',
  },
  fontWeight: 'bold',
  marginBottom: '[-1px]',
});

export const flavourText = css({
  _first: {
    fontWeight: 'medium',
  },
  color: 'white',
  fontFamily: 'body',
  fontSize: {
    base: 'xs',
    lg: 'sm',
  },
  fontWeight: 'thin',
  marginBottom: {
    base: '1',
    xl: '2',
  },
});

export const primaryAttributes = css({
  color: 'white',
  fontFamily: 'display',
  fontSize: 'sm',
});
