import { sva } from '@vers/styled-system/css';

export const tooltip = sva({
  base: {
    content: {
      color: 'text.primary',
      paddingX: '3',
      paddingY: '2',
    },
    header: {
      alignItems: 'center',
      borderBottomWidth: '[1px]',
      borderColor: 'border',
      color: 'text.heading',
      display: 'flex',
      fontWeight: 'medium',
      height: '10',
      justifyContent: 'center',
      overflow: 'hidden',
      paddingX: '6',
      paddingY: '2',
      position: 'relative',
    },
    icon: {
      bottom: '1',
      left: '1',
      position: 'absolute',
      top: '1',
    },
    root: {
      backgroundColor: 'bg.panelElevated',
      borderColor: 'border',
      borderWidth: '[1px]',
      overflow: 'hidden',
      pointerEvents: 'none',
      userSelect: 'none',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
  slots: ['root', 'content', 'header', 'icon'],
  variants: {
    variant: {
      default: {},
    },
  },
});
