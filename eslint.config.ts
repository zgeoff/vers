import path from 'node:path';
import url from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import drizzlePlugin from 'eslint-plugin-drizzle';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import perfectionist from 'eslint-plugin-perfectionist';
import playwright from 'eslint-plugin-playwright';
import reactPlugin from 'eslint-plugin-react';
import unicornPlugin from 'eslint-plugin-unicorn';
import vitest from 'eslint-plugin-vitest';
import tseslint from 'typescript-eslint';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default tseslint.config(
  eslint.configs.recommended,
  prettierConfig,
  unicornPlugin.configs.recommended,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  ...compat.extends('plugin:react-hooks/recommended'),
  jsxA11yPlugin.flatConfigs.recommended,
  perfectionist.configs['recommended-natural'],
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  {
    languageOptions: {
      globals: {
        console: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      drizzle: drizzlePlugin,
    },
    rules: {
      '@typescript-eslint/array-type': [
        'error',
        {
          default: 'generic',
        },
      ],
      '@typescript-eslint/no-inferrable-types': [
        'error',
        {
          ignoreParameters: true,
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/only-throw-error': 'off',
      'drizzle/enforce-delete-with-where': 'off',
      'drizzle/enforce-update-with-where': 'error',
      'perfectionist/sort-enums': ['error', { partitionByComment: true }],
      'perfectionist/sort-exports': [
        'error',
        {
          partitionByComment: true,
        },
      ],
      'perfectionist/sort-imports': [
        'error',
        {
          customGroups: {
            type: {
              node: ['^node:.+'],
              react: ['^react$', '^react-.+'],
              'testing-library': ['^@testing-library'],
              vitest: ['^vitest$'],
            },
            value: {
              node: ['^node:.+'],
              react: ['^react$', '^react-.+'],
              'testing-library': ['^@testing-library'],
              vitest: ['^vitest$'],
            },
          },
          groups: [
            'vitest',
            'testing-library',
            'react',
            'type',
            'node',
            ['builtin', 'external'],
            'internal-type',
            'internal',
            ['parent-type', 'sibling-type', 'index-type'],
            ['parent', 'sibling', 'index'],
            'object',
            'side-effect',
            'unknown',
          ],
          internalPattern: ['^~/.+'],
          newlinesBetween: 'never',
        },
      ],
      'perfectionist/sort-interfaces': ['error', { partitionByComment: true }],
      'perfectionist/sort-jsx-props': [
        'error',
        {
          customGroups: {
            callback: '^on.+$',
            key: '^key$',
            ref: '^ref$',
          },
          groups: ['key', 'ref', 'unknown', 'shorthand', 'callback'],
        },
      ],
      'perfectionist/sort-modules': 'off',
      'perfectionist/sort-object-types': [
        'error',
        { partitionByComment: true },
      ],
      'perfectionist/sort-objects': [
        'error',
        {
          partitionByComment: true,
        },
      ],
      'perfectionist/sort-sets': ['error', { partitionByComment: true }],
      'perfectionist/sort-union-types': ['error', { partitionByComment: true }],
      'unicorn/no-null': 'off',
      'unicorn/number-literal-case': 'off',
      'unicorn/numeric-separators-style': [
        'error',
        {
          hexadecimal: {
            minimumDigits: 10,
          },
        },
      ],
      'unicorn/prevent-abbreviations': 'off',
    },
    settings: {
      react: {
        createClass: 'createReactClass',
        fragment: 'Fragment',
        pragma: 'React',
        version: 'detect',
      },
    },
  },

  // --- react-three-fiber specific config
  {
    files: [
      '**/projects/lib-aether-client/**/*.ts',
      '**/projects/lib-aether-client/**/*.tsx',
    ],
    rules: {
      'react/no-unknown-property': [
        'error',
        {
          ignore: [
            'args',
            'attach',
            'position',
            'rotation',
            'scale',
            'intensity',
            'geometry',
            'far',
            'near',
            'userData',
          ],
        },
      ],
    },
  },

  // --- test specific config
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.all.rules,
      '@typescript-eslint/no-non-null-assertion': 'off',
      'vitest/max-expects': 'off',
      'vitest/no-alias-methods': 'error',
      'vitest/no-conditional-in-test': 'error',
      'vitest/no-focused-tests': 'off',
      'vitest/no-hooks': [
        'error',
        {
          allow: ['afterEach'],
        },
      ],
      'vitest/prefer-expect-assertions': 'off',
      'vitest/prefer-strict-equal': 'error',
      'vitest/require-top-level-describe': 'off',
    },
  },

  // --- playwright specific config
  {
    ...playwright.configs['flat/recommended'],
    files: ['**/*.spec.ts'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
    },
  },

  // --- json config
  {
    ignores: ['**/*.json'],
  },

  // --- mjs config
  {
    extends: [tseslint.configs.disableTypeChecked],
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        process: true,
      },
    },
  },

  // --- cjs config
  {
    extends: [tseslint.configs.disableTypeChecked],
    files: ['**/*.cjs'],
    languageOptions: {
      globals: {
        exports: true,
        module: true,
        process: true,
        require: true,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    ignores: [
      '**/.nx/**',
      '**/build/**',
      '**/dist/**',
      '**/*timestamp*.mjs',
      '**/mockServiceWorker.js',
      '**/projects/app-web/app/gql/**',
      '**/.react-router/**',
      '**/styled-system/**',
    ],
  },
);
