'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const NAV_LINKS = [
  { href: '/calculator', label: 'Calculator' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
]

export default function NavBar() {
  const { user, signInWithGoogle, signOut, loading } = useAuth()
  const pathname = usePathname()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-lg font-semibold text-slate-900 hover:text-slate-700 transition-colors">
          PointsMax
        </Link>

        {/* Nav links — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(link => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'text-slate-900 font-medium'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className="flex items-center gap-2 group"
              >
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
                  {avatarLetter}
                </div>
                <span className="text-sm text-slate-600 group-hover:text-slate-900 hidden sm:block max-w-32 truncate">
                  {user.email}
                </span>
                <span className="text-slate-400 text-xs">▾</span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                  >
                    Profile &amp; Settings
                  </Link>
                  <button
                    onClick={() => { setDropdownOpen(false); signOut() }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}

              {dropdownOpen && (
                <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              )}
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-5 py-2 rounded-full transition-colors"
            >
              Get started
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
