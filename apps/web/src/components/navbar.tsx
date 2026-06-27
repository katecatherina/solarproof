import Link from 'next/link'
import { Sun } from 'lucide-react'

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/meters', label: 'Meters' },
  { href: '/certificates', label: 'Certificates' },
  { href: '/governance', label: 'Governance' },
  { href: '/verify', label: 'Verify' },
]

export function Navbar() {
  return (
    <nav className="border-b border-gray-200 bg-white" aria-label="Main navigation">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded">
          <Sun className="h-5 w-5 text-yellow-500" aria-hidden="true" />
          SolarProof
        </Link>
        <div className="flex items-center gap-6" role="list">
          {links.map((l) => (
            <Link key={l.href} href={l.href} role="listitem" className="text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 rounded">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
