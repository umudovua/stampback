import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * Simulyasiya daxilində işləyən kod üçün determinizm qoruyucusu (docs/architecture.md, 5.2).
 * Bu API-lər fərqli brauzer və prosessorlarda fərqli nəticə verə və ya real vaxtdan asılı ola bilər.
 */
const NON_DETERMINISTIC_MATH = [
  'random',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'exp',
  'expm1',
  'log',
  'log1p',
  'log2',
  'log10',
  'pow',
  'cbrt',
  'hypot',
].map((property) => ({
  object: 'Math',
  property,
  message: 'Platformalar arası deterministik deyil. Bax: docs/architecture.md, bölmə 5.2.',
}));

export default defineConfig(
  { ignores: ['**/dist/**', '**/node_modules/**', 'pnpm-lock.yaml'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['packages/server/**/*.ts', 'tools/**/*.ts', 'eslint.config.js', 'vitest.config.ts'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  {
    // shared paketi həm brauzerdə, həm Node-da işləyir: mühərrik, DOM və şəbəkə asılılığı yoxdur.
    files: ['packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['phaser', 'preact', 'preact/*'],
              message: 'shared client-dən asılı ola bilməz.',
            },
            {
              group: ['colyseus', '@colyseus/*'],
              message: 'shared serverdən asılı ola bilməz.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'shared Node-da da işləməlidir.' },
        { name: 'document', message: 'shared Node-da da işləməlidir.' },
        { name: 'navigator', message: 'shared Node-da da işləməlidir.' },
        { name: 'localStorage', message: 'shared Node-da da işləməlidir.' },
      ],
    },
  },
  {
    // Simulyasiya kodu: fizika və qaydalar deterministik olmalıdır.
    files: [
      'packages/shared/src/physics/**/*.ts',
      'packages/shared/src/rules/**/*.ts',
      'packages/shared/src/parcels/**/*.ts',
      'packages/shared/src/maps/**/*.ts',
    ],
    rules: {
      'no-restricted-properties': [
        'error',
        ...NON_DETERMINISTIC_MATH,
        {
          object: 'Date',
          property: 'now',
          message: 'Bunun əvəzinə tam ədədli tick sayından istifadə edin.',
        },
        {
          object: 'performance',
          property: 'now',
          message: 'Bunun əvəzinə tam ədədli tick sayından istifadə edin.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Bunun əvəzinə tam ədədli tick sayından istifadə edin.' },
        { name: 'performance', message: 'Bunun əvəzinə tam ədədli tick sayından istifadə edin.' },
        { name: 'window', message: 'shared Node-da da işləməlidir.' },
        { name: 'document', message: 'shared Node-da da işləməlidir.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='**']",
          message: 'Üstə qaldırma deterministik zəmanətli deyil. Açıq vurma istifadə edin.',
        },
      ],
    },
  },
);
