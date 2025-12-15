import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      '.mocharc.cjs'
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 5,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'kysely',
              importNames: ['Generated'],
              message: 'Import Generated from src/common/kysely-types/generated instead.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.property.name='executeTakeFirstOrThrow']:has(CallExpression[callee.property.name='selectFrom'])[callee.object.callee.property.name!='limit'][callee.object.callee.property.name!='returning'][callee.object.callee.property.name!='returningAll']",
          message: 'You must call .limit(1) before executeTakeFirstOrThrow().',
        },
        {
          selector:
            "CallExpression[callee.property.name='executeTakeFirst']:has(CallExpression[callee.property.name='selectFrom'])[callee.object.callee.property.name!='limit'][callee.object.callee.property.name!='returning'][callee.object.callee.property.name!='returningAll']",
          message: 'You must call .limit(1) before executeTakeFirst().',
        },
        {
          selector:
            "CallExpression[callee.property.name='set'][callee.object.callee.property.name='updateTable'][callee.object.arguments.0.value=/^(interview_transcription|subscription|payment_method)$/] > ObjectExpression.arguments:not(:has(Property[key.name='updated_at']))",
          message: 'Include updated_at when calling updateTable(...).set({...}).',
        },
      ],
      'prefer-spread': 'off',
      'prettier/prettier': [
        'error',
        {
          printWidth: 120,
          useTabs: true,
          proseWrap: 'never',
          arrowParens: 'avoid',
          trailingComma: 'all',
        },
      ],
    },
  },
);
