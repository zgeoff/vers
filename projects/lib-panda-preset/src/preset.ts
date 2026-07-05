import { definePreset } from '@pandacss/dev';
import presetBase from '@pandacss/preset-base';
import presetPanda from '@pandacss/preset-panda';

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
    'Fira Mono': {
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
  presets: [
    presetBase,

    // @ts-expect-error - pandacss's bundled default preset doesn't satisfy its own
    // Preset type under exactOptionalPropertyTypes
    presetPanda,
  ],
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
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
            marginLeft: value,
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
            marginRight: value,
          };
        },
        values: 'spacing',
      },
      marginY: {
        className: 'my',
        transform(value) {
          return {
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
            marginBottom: value,
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
            marginTop: value,
          };
        },
        values: 'spacing',
      },
      paddingX: {
        className: 'px',
        transform(value) {
          return {
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
            paddingLeft: value,
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
            paddingRight: value,
          };
        },
        values: 'spacing',
      },
      paddingY: {
        className: 'py',
        transform(value) {
          return {
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
            paddingBottom: value,
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
            paddingTop: value,
          };
        },
        values: 'spacing',
      },
      rounded: {
        className: 'rounded',
        transform(value) {
          return {
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
            borderRadius: value,
          };
        },
        values: 'radii',
      },
      roundedBottom: {
        className: 'rounded-b',
        transform(value) {
          return {
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
            borderBottomLeftRadius: value,
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
            borderBottomRightRadius: value,
          };
        },
        values: 'radii',
      },
      roundedTop: {
        className: 'rounded-t',
        transform(value) {
          return {
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
            borderTopLeftRadius: value,
            // oxlint-disable-next-line typescript/no-unsafe-assignment -- baseline(#236)
            borderTopRightRadius: value,
          };
        },
        values: 'radii',
      },
    },
  },
});
