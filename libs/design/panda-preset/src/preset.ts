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
      semanticTokens: {
        colors: {
          accent: {
            enemy: { value: '{colors.ink.600}' },
            enemyBright: { value: '{colors.ink.400}' },
            rare: { value: '{colors.ink.300}' },
            self: { value: '{colors.ink.200}' },
            selfBright: { value: '{colors.ink.50}' },
            world: { value: '{colors.ink.500}' },
            worldBright: { value: '{colors.ink.300}' },
          },
          bg: {
            panel: { value: '{colors.ink.950}' },
            panelElevated: { value: '{colors.ink.900}' },
          },
          border: {
            DEFAULT: { value: 'rgba(255, 255, 255, 0.08)' },
            danger: { value: 'rgba(255, 255, 255, 0.5)' },
            strong: { value: 'rgba(255, 255, 255, 0.14)' },
            subtle: { value: 'rgba(255, 255, 255, 0.06)' },
          },
          text: {
            danger: { value: '{colors.ink.50}' },
            faint: { value: '{colors.ink.800}' },
            heading: { value: '{colors.ink.50}' },
            muted: { value: '{colors.ink.500}' },
            primary: { value: '{colors.ink.100}' },
          },
        },
      },
      tokens: {
        colors: {
          ink: {
            50: { value: '#F2F2F2' },
            100: { value: '#E5E5E5' },
            200: { value: '#CCCCCC' },
            300: { value: '#B3B3B3' },
            400: { value: '#999999' },
            500: { value: '#808080' },
            600: { value: '#666666' },
            700: { value: '#4D4D4D' },
            800: { value: '#404040' },
            900: { value: '#262626' },
            950: { value: '#171717' },
          },
        },
      },
    },
  },
  utilities: {
    extend: {
      marginX: {
        className: 'mx',
        transform(value: string) {
          return {
            marginLeft: value,
            marginRight: value,
          };
        },
        values: 'spacing',
      },
      marginY: {
        className: 'my',
        transform(value: string) {
          return {
            marginBottom: value,
            marginTop: value,
          };
        },
        values: 'spacing',
      },
      paddingX: {
        className: 'px',
        transform(value: string) {
          return {
            paddingLeft: value,
            paddingRight: value,
          };
        },
        values: 'spacing',
      },
      paddingY: {
        className: 'py',
        transform(value: string) {
          return {
            paddingBottom: value,
            paddingTop: value,
          };
        },
        values: 'spacing',
      },
    },
  },
});
