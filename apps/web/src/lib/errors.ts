/**
 * Structured error categories for external service failures.
 *
 * Provides consistent error codes, HTTP status mapping, and retriable/fatal
 * distinction so API routes return actionable responses and logs carry context.
 *
 * Usage:
 *   import { AppError, ErrorCategory } from '@/lib/errors'
 *   throw new AppError(ErrorCategory.STELLAR_TIMEOUT, 'RPC timed out', { correlationId })
 *
 *   // In a route handler:
 *   catch (err) {
 *     return errorResponse(err)
 *   }
 */

export const ErrorCategory = {
  // Stellar / RPC
  STELLAR_TIMEOUT:   'STELLAR_TIMEOUT',
  STELLAR_CIRCUIT:   'STELLAR_CIRCUIT',
  STELLAR_RPC:       'STELLAR_RPC',
  // Supabase / database
  DB_QUERY:          'DB_QUERY',
  DB_CONSTRAINT:     'DB_CONSTRAINT',
  // Input validation
  VALIDATION:        'VALIDATION',
  // Auth
  UNAUTHORIZED:      'UNAUTHORIZED',
  // Generic
  INTERNAL:          'INTERNAL',
} as const

export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory]

/** Whether clients should retry requests that fail with this category. */
export const RETRIABLE: ReadonlySet<ErrorCategory> = new Set([
  ErrorCategory.STELLAR_TIMEOUT,
  ErrorCategory.STELLAR_CIRCUIT,
  ErrorCategory.DB_QUERY,
])

/** Default HTTP status per category. */
const HTTP_STATUS: Record<ErrorCategory, number> = {
  STELLAR_TIMEOUT:  503,
  STELLAR_CIRCUIT:  503,
  STELLAR_RPC:      502,
  DB_QUERY:         500,
  DB_CONSTRAINT:    409,
  VALIDATION:       400,
  UNAUTHORIZED:     401,
  INTERNAL:         500,
}

export class AppError extends Error {
  readonly category: ErrorCategory
  readonly meta: Record<string, unknown>
  readonly retriable: boolean
  readonly httpStatus: number

  constructor(
    category: ErrorCategory,
    message: string,
    meta: Record<string, unknown> = {}
  ) {
    super(message)
    this.name = 'AppError'
    this.category = category
    this.meta = meta
    this.retriable = RETRIABLE.has(category)
    this.httpStatus = HTTP_STATUS[category]
  }
}

/**
 * Convert any caught value to an AppError.
 * Preserves AppError instances; wraps everything else as INTERNAL.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  const message = err instanceof Error ? err.message : String(err)
  return new AppError(ErrorCategory.INTERNAL, message)
}

/**
 * Build a Next.js-compatible JSON response body for an error.
 * Returns `{ error, code, retriable }` so clients can branch on `code`.
 */
export function errorBody(err: AppError): {
  error: string
  code: ErrorCategory
  retriable: boolean
} {
  return { error: err.message, code: err.category, retriable: err.retriable }
}
