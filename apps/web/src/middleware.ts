import { NextRequest, NextResponse } from 'next/server'

export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'pt'] as const
export type Locale = typeof SUPPORTED_LOCALES[number]
export const DEFAULT_LOCALE: Locale = 'en'

/**
 * Parse the Accept-Language header and return the best supported locale,
 * falling back to DEFAULT_LOCALE if none match.
 */
export function detectLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE
  for (const part of acceptLanguage.split(',')) {
    const lang = part.split(';')[0].trim().toLowerCase().slice(0, 2) as Locale
    if (SUPPORTED_LOCALES.includes(lang)) return lang
  }
  return DEFAULT_LOCALE
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // If a locale cookie is already set, honour it
  const cookieLocale = req.cookies.get('locale')?.value as Locale | undefined
  const locale = SUPPORTED_LOCALES.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : detectLocale(req.headers.get('accept-language'))

  const res = NextResponse.next()
  // Forward resolved locale to server components via header
  res.headers.set('x-locale', locale)
  // Persist in cookie so subsequent requests skip detection
  if (!cookieLocale || cookieLocale !== locale) {
    res.cookies.set('locale', locale, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  }
  return res
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
