import { definePreset } from '@pandacss/dev';
import presetBase from '@pandacss/preset-base';
import presetPanda from '@pandacss/preset-panda';

export const preset = definePreset({
  conditions: {
    invalid: '&:is([aria-invalid=true])',
  },
  globalCss: {
    html: {
      '--global-color-border': 'colors.border.subtle',
      '--global-color-placeholder': 'colors.ink.500',
      '--global-font-body': 'fonts.body',
      '--global-font-heading': 'fonts.display',
      '--global-font-mono': 'fonts.mono',
    },
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
        dsCast: {
          '0%': { width: '0%' },
          '70%': { width: '100%' },
          '76%': { width: '0%' },
          '100%': { width: '0%' },
        },
        dsFloat: {
          '0%': { opacity: 0, transform: 'translate(-50%, 0)' },
          '14%': { opacity: 1 },
          '100%': { opacity: 0, transform: 'translate(-50%, -34px)' },
        },
        dsPulse: {
          '0%, 100%': { opacity: 0.45 },
          '50%': { opacity: 1 },
        },
        dsShimmer: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        dsSpin: {
          to: { transform: 'rotate(360deg)' },
        },
      },
      semanticTokens: {
        colors: {
          accent: {
            enemy: { value: '{colors.violet.400}' },
            enemyBright: { value: '{colors.violet.300}' },
            rare: { value: '{colors.pink.500}' },
            self: { value: '{colors.gold.400}' },
            selfBright: { value: '{colors.gold.200}' },
            world: { value: '{colors.teal.400}' },
            worldBright: { value: '{colors.teal.300}' },
          },
          bg: {
            canvas: { value: '{colors.navy.900}' },
            panel: { value: '{colors.navy.800}' },
            panelElevated: { value: '{colors.navy.700}' },
          },
          border: {
            DEFAULT: { value: 'rgba(255, 255, 255, 0.08)' },
            strong: { value: 'rgba(255, 255, 255, 0.14)' },
            subtle: { value: 'rgba(255, 255, 255, 0.06)' },
          },
          text: {
            faint: { value: '{colors.ink.800}' },
            heading: { value: '{colors.ink.50}' },
            muted: { value: '{colors.ink.500}' },
            primary: { value: '{colors.ink.100}' },
          },
        },
      },
      tokens: {
        colors: {
          gold: {
            50: { value: '#FBF8F1' },
            100: { value: '#F5EDDF' },
            200: { value: '#F2E8D5' },
            300: { value: '#E9D8BF' },
            400: { value: '#D8A56E' },
            500: { value: '#CD9E6E' },
            600: { value: '#C1834E' },
            700: { value: '#B36F43' },
            800: { value: '#955939' },
            900: { value: '#794933' },
            950: { value: '#341E16' },
          },
          ink: {
            50: { value: '#EEF2FA' },
            100: { value: '#E8EDF7' },
            200: { value: '#DBE3EF' },
            300: { value: '#C3CEE0' },
            400: { value: '#9AA6BF' },
            500: { value: '#8FA0C2' },
            600: { value: '#8B94A7' },
            700: { value: '#66738C' },
            800: { value: '#5B6B8A' },
            900: { value: '#4A5773' },
          },
          navy: {
            600: { value: '#3F5170' },
            700: { value: '#1A2740' },
            800: { value: '#0D1220' },
            900: { value: '#05070F' },
            950: { value: '#04060D' },
          },
          pink: {
            300: { value: '#FFD7EA' },
            400: { value: '#F6A9D0' },
            500: { value: '#F472B6' },
          },
          teal: {
            300: { value: '#5EEAD4' },
            400: { value: '#2DD4BF' },
          },
          violet: {
            300: { value: '#C4B5FD' },
            400: { value: '#A78BFA' },
          },
        },
        fonts: {
          body: { value: 'Manrope, sans-serif' },
          display: { value: '"Chakra Petch", sans-serif' },
          mono: { value: '"IBM Plex Mono", monospace' },
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
