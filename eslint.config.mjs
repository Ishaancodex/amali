import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const layeringRule = [
  'error',
  {
    zones: [
      {
        target: './src/domain',
        from: ['./src/store', './src/ui', './src/surfaces', './src/shell'],
        message: 'domain/* must stay pure TypeScript: no React, store, ui or surfaces imports.',
      },
      {
        target: './src/domain',
        from: 'react',
        message: 'domain/* must not import React.',
      },
      {
        target: './src/store',
        from: ['./src/ui', './src/surfaces', './src/shell'],
        message: 'store/* may depend on domain/config/lib/types only.',
      },
      {
        target: './src/ui',
        from: ['./src/store', './src/domain'],
        message: 'ui/* primitives must not read the store or domain logic directly.',
      },
    ],
  },
];

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      'import/no-restricted-paths': layeringRule,
    },
  },
  {
    ignores: [
      '.next/**',
      '.next-*/**',
      'test-results/**',
      'out/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'next-env.d.ts',
    ],
  },
];

export default eslintConfig;
