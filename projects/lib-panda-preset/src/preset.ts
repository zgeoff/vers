import { definePreset } from '@pandacss/dev';
import defaultPreset from '@pandacss/dev/presets';

export const preset = definePreset({
  conditions: {
    invalid: '&:is([aria-invalid=true])',
  },
  globalCss: {
    html: {
      '--global-color-border': 'colors.neutral.400',
      '--global-color-placeholder': 'colors.gray.500',
      '--global-font-body': 'Karla, sans-serif',
      '--global-font-heading': 'Josefin Sans, sans-serif',
      '--global-font-mono': 'Fira Mono, monospace',
    },
  },
  globalFontface: {
    'Fira Mona': {
      fontDisplay: 'swap',
      fontStyle: 'normal',
      fontWeight: 400,
      src: [
        'url(/assets/fonts/fira-mono-regular.woff) format("woff")',
        'url(/assets/fonts/fira-mono-regular.woff2) format("woff2")',
      ],
    },
    'Josefin Sans': {
      fontDisplay: 'swap',
      fontStyle: 'normal',
      fontWeight: 600,
      src: [
        'url(/assets/fonts/josefin-sans-semi-bold.woff) format("woff")',
        'url(/assets/fonts/josefin-sans-semi-bold.woff2) format("woff2")',
      ],
    },
    Karla: [
      {
        fontDisplay: 'swap',
        fontStyle: 'normal',
        fontWeight: 300,
        src: [
          'url(/assets/fonts/karla-light.woff) format("woff")',
          'url(/assets/fonts/karla-light.woff2) format("woff2")',
        ],
      },
      {
        fontDisplay: 'swap',
        fontStyle: 'normal',
        fontWeight: 400,
        src: [
          'url(/assets/fonts/karla-regular.woff) format("woff")',
          'url(/assets/fonts/karla-regular.woff2) format("woff2")',
        ],
      },
      {
        fontDisplay: 'swap',
        fontStyle: 'normal',
        fontWeight: 700,
        src: [
          'url(/assets/fonts/karla-bold.woff) format("woff")',
          'url(/assets/fonts/karla-bold.woff2) format("woff2")',
        ],
      },
    ],
  },
  globalVars: {
    '--font-fira-code': 'Fira Mono, monospace',
    '--font-josefin-sans': 'Josefin Sans, sans-serif',
    '--font-karla': 'Karla, sans-serif',
  },
  name: 'vers-preset',
  presets: [defaultPreset],
  theme: {
    extend: {
      keyframes: {
        'caret-blink': {
          '0%, 70%, 100%': { opacity: 1 },
          '20%, 50%': { opacity: 0 },
        },
      },
      tokens: {
        colors: {
          /* eslint-disable perfectionist/sort-objects */
          twine: {
            50: { value: '#FBF8F1' },
            100: { value: '#F5EDDF' },
            200: { value: '#E9D8BF' },
            300: { value: '#DBBD96' },
            400: { value: '#CD9E6E' },
            500: { value: '#C1834E' },
            600: { value: '#B36F43' },
            700: { value: '#955939' },
            800: { value: '#794933' },
            900: { value: '#623D2C' },
            950: { value: '#341E16' },
          },
          /* eslint-enable perfectionist/sort-objects */
        },
        fonts: {
          fira: { value: 'var(--font-fira-code), Menlo, monospace' },
          josefin: { value: 'var(--font-josefin-sans), sans-serif' },
          karla: { value: 'var(--font-karla), sans-serif' },
        },
        spacing: {
          hairline: { value: '1px' },
        },
      },
    },
  },
  utilities: {
    extend: {
      borderGradient: {
        className: 'border-gradient',
        transform(value) {
          return {
            borderImage: `linear-gradient(45deg, transparent 5%, ${value} 50%, transparent 99%) 1`,
          };
        },
        values: 'colors',
      },
      marginX: {
        className: 'mx',
        transform(value) {
          return {
            marginLeft: value,
            marginRight: value,
          };
        },
        values: 'spacing',
      },
      marginY: {
        className: 'my',
        transform(value) {
          return {
            marginBottom: value,
            marginTop: value,
          };
        },
        values: 'spacing',
      },
      paddingX: {
        className: 'px',
        transform(value) {
          return {
            paddingLeft: value,
            paddingRight: value,
          };
        },
        values: 'spacing',
      },
      paddingY: {
        className: 'py',
        transform(value) {
          return {
            paddingBottom: value,
            paddingTop: value,
          };
        },
        values: 'spacing',
      },
      rounded: {
        className: 'rounded',
        transform(value) {
          return {
            borderRadius: value,
          };
        },
        values: 'radii',
      },
      roundedBottom: {
        className: 'rounded-b',
        transform(value) {
          return {
            borderBottomLeftRadius: value,
            borderBottomRightRadius: value,
          };
        },
        values: 'radii',
      },
      roundedTop: {
        className: 'rounded-t',
        transform(value) {
          return {
            borderTopLeftRadius: value,
            borderTopRightRadius: value,
          };
        },
        values: 'radii',
      },
    },
  },
});
