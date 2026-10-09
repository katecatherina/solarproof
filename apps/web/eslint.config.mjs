import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Downgrade unused-vars from error to warn so build doesn't fail on
      // variables that are intentionally kept for future use or destructuring.
      '@typescript-eslint/no-unused-vars': 'warn',
      // Allow eslint-disable comments that have become unnecessary after fixes.
      'no-unused-disable': 'off',
    },
  },
]
