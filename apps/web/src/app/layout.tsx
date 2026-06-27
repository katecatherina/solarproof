import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '@/components/navbar'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/middleware'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SolarProof — Cryptographic Renewable Energy Certification on Stellar',
  description:
    'End-to-end cryptographic proof of renewable energy. Every kWh signed at the meter, anchored on Stellar, publicly verifiable.',
  openGraph: {
    title: 'SolarProof',
    description: 'Cryptographic renewable energy certification on Stellar',
    url: 'https://solarproof.vercel.app',
    siteName: 'SolarProof',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers()
  const rawLocale = headerList.get('x-locale') ?? DEFAULT_LOCALE
  const locale: Locale = SUPPORTED_LOCALES.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : DEFAULT_LOCALE

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <Navbar />
          <main className="min-h-screen bg-gray-50">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
