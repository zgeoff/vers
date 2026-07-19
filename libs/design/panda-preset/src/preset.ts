import { definePreset } from '@pandacss/dev';
import presetBase from '@pandacss/preset-base';
import presetPanda from '@pandacss/preset-panda';

export const preset = definePreset({
  conditions: {
    invalid: '&:is([aria-invalid=true])',
  },
  globalCss: {
    body: {
      color: 'token(colors.text.primary)',
      fontFamily: 'token(fonts.sans)',
    },

    // a viewport-pinned ambient wash behind the fixed game canvas (which sits at z-index -1)
    'body::before': {
      backgroundImage:
        'radial-gradient(60% 60% at 15% 4%, rgba(45, 212, 191, 0.05), transparent 60%), radial-gradient(50% 50% at 92% 96%, rgba(167, 139, 250, 0.06), transparent 60%)',
      content: '""',
      inset: '0',
      pointerEvents: 'none',
      position: 'fixed',
      zIndex: '[-2]',
    },
    html: {
      '--global-color-border': 'colors.border.subtle',
      '--global-color-placeholder': 'colors.ink.500',
      '--global-font-body': 'fonts.sans',
      '--global-font-mono': 'fonts.mono',
      backgroundColor: 'token(colors.bg.canvas)',
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
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideInFromBottom: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        slideOutToBottom: {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(100vh)' },
        },
      },
      semanticTokens: {
        colors: {
          accent: {
            damage: {
              cognitive: { value: '#e879f9' },
              cold: { value: '#60a5fa' },
              electric: { value: '#fbbf24' },
              heat: { value: '#fb7185' },
              null: { value: '#a78bfa' },
              physical: { value: '{colors.ink.300}' },
              toxic: { value: '#4ade80' },
            },
            enemy: { value: '#fb7185' },
            rarity: {
              artisan: { value: '#a78bfa' },
              enhanced: { value: '#60a5fa' },
              normal: { value: '{colors.ink.300}' },
              unique: { value: '#f472b6' },
            },
            self: { value: '#e5c79c' },
            selfDeep: { value: '#d8a56e' },
            world: { value: '#5eead4' },
            worldBright: { value: '#7ff0e2' },
            worldDeep: { value: '#2dd4bf' },
          },
          bg: {
            canvas: { value: '#05070f' },
            panel: { value: '{colors.ink.900}' },
            panelElevated: { value: '{colors.ink.800}' },
          },
          border: {
            DEFAULT: { value: 'rgba(94, 234, 212, 0.12)' },
            danger: { value: 'rgba(251, 113, 133, 0.4)' },
            strong: { value: 'rgba(94, 234, 212, 0.18)' },
            subtle: { value: 'rgba(94, 234, 212, 0.07)' },
          },
          text: {
            danger: { value: '#fb7185' },
            emphasis: { value: '#cfe9e3' },
            faint: { value: '{colors.ink.600}' },
            heading: { value: '{colors.ink.50}' },
            muted: { value: '{colors.ink.400}' },
            primary: { value: '{colors.ink.200}' },
          },
        },
      },
      tokens: {
        colors: {
          ink: {
            50: { value: '#eef2fa' },
            100: { value: '#dbe3ef' },
            200: { value: '#c3cee0' },
            300: { value: '#9fb0c9' },
            400: { value: '#8fa0c2' },
            500: { value: '#66738c' },
            600: { value: '#5b6b8a' },
            700: { value: '#3f4b60' },
            800: { value: '#171b28' },
            900: { value: '#0a0e18' },
            950: { value: '#05070f' },
          },
        },
        fontSizes: {
          '2xs': { value: '0.625rem' },
        },
        fonts: {
          display: { value: "'Chakra Petch', sans-serif" },
          mono: { value: "'IBM Plex Mono', monospace" },
          sans: { value: "'Manrope', sans-serif" },
        },
        sizes: {
          contentMax: { value: '120rem' },
          panelMin: { value: '6rem' },
          rail: { value: '4rem' },
          tileMin: { value: '9rem' },
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
