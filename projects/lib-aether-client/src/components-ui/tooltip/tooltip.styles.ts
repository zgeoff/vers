import { sva } from '@vers/styled-system/css';

export const tooltip = sva({
  base: {
    content: {
      paddingX: '3',
      paddingY: '2',
    },
    header: {
      _before: {
        borderBottomWidth: '1',
        borderRightWidth: '1',
        borderTopWidth: '1',
        bottom: 'hairline',
        content: '""',
        left: '0',
        position: 'absolute',
        right: 'hairline',
        roundedBottom: 'sm',
        top: 'hairline',
        userSelect: 'none',
        zIndex: '1',
      },
      alignItems: 'center',
      backgroundGradient: 'to-r',
      borderTopWidth: '1',
      display: 'flex',
      gradientToPosition: '80%',
      height: '10',
      justifyContent: 'center',
      overflow: 'hidden',
      paddingX: '6',
      paddingY: '2',
      position: 'relative',
    },
    headerBackground: {
      left: '0',
      opacity: '0.1',
      position: 'absolute',
      top: '0',
      zIndex: '-1',
    },
    icon: {
      bottom: '1',
      left: '1',
      position: 'absolute',
      top: '1',
    },
    root: {
      backgroundGradient: 'to-b',
      borderColor: 'neutral.900',
      borderWidth: '1',
      boxShadow: 'md',
      gradientFrom: 'neutral.950',
      gradientTo: 'neutral.950/80',
      overflow: 'hidden',
      pointerEvents: 'none',
      rounded: 'sm',
      userSelect: 'none',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
  slots: ['root', 'content', 'header', 'icon', 'headerBackground'],
  variants: {
    variant: {
      default: {
        content: {
          color: 'sky.200',
        },
        header: {
          _before: {
            borderGradient: 'sky.600',
          },
          borderGradient: 'sky.500',
          color: 'sky.100',
          fontFamily: 'Karla',
          fontWeight: 'medium',
          gradientFrom: 'sky.700',
          gradientTo: 'transparent',
        },
        headerBackground: {
          stroke: 'sky.300',
        },
      },
    },
  },
});
