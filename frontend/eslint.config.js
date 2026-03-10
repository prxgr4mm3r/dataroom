import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const mantineRestrictedPaths = [
  {
    name: '@mantine/core',
    message: 'Import Mantine through shared/ui wrappers.',
  },
  {
    name: '@mantine/hooks',
    message: 'Import Mantine hooks through shared/ui wrappers or shared/hooks.',
  },
  {
    name: '@mantine/notifications',
    message: 'Import notifications through shared/ui wrappers.',
  },
]

const createNoRestrictedImportsRule = ({
  patterns = [],
  message = '',
  includeMantineRestrictions = true,
} = {}) => {
  const config = {}

  if (includeMantineRestrictions) {
    config.paths = mantineRestrictedPaths
  }

  if (patterns.length) {
    config.patterns = [
      {
        group: patterns,
        message,
      },
    ]
  }

  return ['error', config]
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-restricted-imports': createNoRestrictedImportsRule(),
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createNoRestrictedImportsRule({
        patterns: ['@/entities/**', '@/features/**', '@/widgets/**', '@/pages/**', '@/app/**'],
        message: 'Shared layer must not depend on entities/features/widgets/pages/app.',
      }),
    },
  },
  {
    files: ['src/entities/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createNoRestrictedImportsRule({
        patterns: ['@/features/**', '@/widgets/**', '@/pages/**', '@/app/**'],
        message: 'Entities layer must not depend on features/widgets/pages/app.',
      }),
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createNoRestrictedImportsRule({
        patterns: ['@/widgets/**', '@/pages/**', '@/app/**'],
        message: 'Features layer must not depend on widgets/pages/app.',
      }),
    },
  },
  {
    files: ['src/widgets/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': createNoRestrictedImportsRule({
        patterns: ['@/pages/**', '@/app/**'],
        message: 'Widgets layer must not depend on pages/app.',
      }),
    },
  },
  {
    files: ['src/shared/ui/**/*.{ts,tsx}', 'src/app/providers/theme-provider.tsx'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
])
