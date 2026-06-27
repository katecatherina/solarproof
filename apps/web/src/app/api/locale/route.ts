import { NextRequest, NextResponse } from 'next/server'
import { SUPPORTED_LOCALES, type Locale } from '@/middleware'

/**
 * POST /api/locale  { locale: "es" }
 * Sets the locale cookie so subsequent requests use the chosen locale.
 */
export async function POST(req: NextRequest) {
  const { locale } = await req.json().catch(() => ({}))
  if (!SUPPORTED_LOCALES.includes(locale as Locale)) {
    return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 })
  }
  const res = NextResponse.json({ locale })
  res.cookies.set('locale', locale as string, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  return res
}
