import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    plugins: { import: importPlugin },
    languageOptions: { parserOptions: { project: './tsconfig.json' } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-else-return': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'vscode',
                '../adapters/*',
                '../../adapters/*',
                '../markdownItPlugin/*',
                '../../markdownItPlugin/*',
              ],
              message:
                'src/core must stay pure: no vscode, no adapters, no markdownItPlugin imports',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/markdownItPlugin/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['vscode'],
              message: 'markdownItPlugin runs in the preview process; no vscode imports',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/previewScript/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'vscode',
                'fs',
                'fs/*',
                'path',
                'node:*',
                'markdown-it',
                '../adapters/*',
                '../../adapters/*',
                '../markdownItPlugin/*',
                '../../markdownItPlugin/*',
              ],
              message: 'previewScript runs in the preview webview: browser APIs and src/core only',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['test/e2e/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../src/*', '../../../src/*'],
              message: 'e2e tests must not import extension internals',
            },
          ],
        },
      ],
    },
  },
];
