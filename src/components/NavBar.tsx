'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { getRegionFromPath } from '@/lib/regions'
import { useTheme } from 'next-themes'
import { Moon, Sun, Menu, X } from 'lucide-react'

function PMLogoMark({ className }: { className?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="14" cy="14" r="14" fill="var(--pm-accent)" />
      <rect x="12.75" y="7" width="2.5" height="10" rx="1.25" fill="var(--pm-bg)" />
      <path
        d="M9 13L14 8L19 13"
        stroke="var(--pm-bg)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="8" y="19" width="12" height="2" rx="1" fill="var(--pm-bg)" />
    </svg>
  )
}

export default function NavBar() {
  const { user, signInWithGoogle, signOut, loading } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const pathname = usePathname()
  const region = getRegionFromPath(pathname)
  
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Track scroll for backdrop blur enhancement
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Flattened nav links (tools moved to main nav)
  const navLinks = useMemo(() => ([
    { href: `/${region}/calculator`, label: 'Calculator' },
    { href: `/${region}/award-search`, label: 'Award Search' },
    { href: `/${region}/inspire`, label: 'Inspire' },
    { href: `/${region}/trip-builder`, label: 'Trip Builder' },
  ]), [region])

  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled ? 'bg-pm-bg/80 backdrop-blur-xl border-b border-pm-border' : 'bg-pm-bg/50 backdrop-blur-sm'
      }`}
      style={{ height: 'var(--navbar-height)' }}
    >
      <div className="pm-shell h-full flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href={`/${region}`}
          className="inline-flex items-center gap-2 text-pm-ink-900 font-bold text-lg tracking-tight"
        >
          <PMLogoMark />
          <span>PointsMax</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-pm-accent-soft text-pm-accent'
                    : 'text-pm-ink-700 hover:text-pm-ink-900 hover:bg-pm-surface-soft'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Theme toggle - icon only, smaller */}
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-pm-ink-500 hover:text-pm-ink-900 hover:bg-pm-surface-soft transition-colors"
            aria-label="Toggle theme"
            type="button"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {/* Desktop: Auth / CTA */}
          <div className="hidden lg:flex items-center gap-2">
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-pm-border animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-full border border-pm-border bg-pm-surface hover:bg-pm-surface-soft transition-colors"
                >
                  <span className="w-6 h-6 rounded-full bg-pm-accent text-pm-bg text-xs font-bold flex items-center justify-center">
                    {avatarLetter}
                  </span>
                  <span className="text-sm text-pm-ink-700 max-w-32 truncate">{user.email}</span>
                </button>

                {accountOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 pm-card p-2 shadow-2xl">
                    <p className="px-3 py-2 text-xs text-pm-ink-500 border-b border-pm-border truncate">{user.email}</p>
                    <Link
                      href="/profile"
                      onClick={() => setAccountOpen(false)}
                      className="block px-3 py-2 text-sm rounded-lg hover:bg-pm-surface-soft text-pm-ink-900"
                    >
                      Profile &amp; Settings
                    </Link>
                    <button
                      onClick={() => {
                        setAccountOpen(false)
                        signOut()
                      }}
                      className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-pm-danger-soft text-pm-danger"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={signInWithGoogle} className="pm-button text-sm px-5 py-2">
                Start free
              </button>
            )}
          </div>

          {/* Mobile: Hamburger */}
          <button
            onClick={() => {
              setMenuOpen((v) => !v)
              setAccountOpen(false)
            }}
            className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-full text-pm-ink-700 hover:bg-pm-surface-soft transition-colors"
            aria-label="Toggle menu"
            type="button"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="lg:hidden border-t border-pm-border bg-pm-surface shadow-lg">
          <div className="pm-shell py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-xl px-3 py-3 text-sm font-medium ${
                  pathname === link.href
                    ? 'bg-pm-accent-soft text-pm-accent'
                    : 'text-pm-ink-700 hover:bg-pm-surface-soft'
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile auth */}
            <div className="pt-3 mt-3 border-t border-pm-border">
              {loading ? (
                <div className="h-10 rounded-lg bg-pm-border animate-pulse" />
              ) : user ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-3 py-3 text-sm font-medium text-pm-ink-700 hover:bg-pm-surface-soft"
                  >
                    Profile & Settings
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      signOut()
                    }}
                    className="w-full text-left rounded-xl px-3 py-3 text-sm font-medium text-pm-danger hover:bg-pm-danger-soft"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => {
                    setMenuOpen(false)
                    signInWithGoogle()
                  }}
                  className="w-full pm-button text-sm px-5 py-3"
                >
                  Start free
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Backdrop for account dropdown */}
      {accountOpen && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => setAccountOpen(false)}
        />
      )}
    </header>
  )
}
