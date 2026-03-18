'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { getRegionFromPath } from '@/lib/regions'
import { useTheme } from 'next-themes'
import { Moon, Sun, Menu, X, ChevronDown } from 'lucide-react'

function PMLogoMark() {
  return (
    <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] shadow-sm transition-transform duration-500 group-hover:scale-105">
      {/* Spinning Conic Gradient for border glow */}
      <div className="absolute inset-[-150%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,rgba(0,0,0,0.2)_50%,transparent_100%)] dark:bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,rgba(255,255,255,0.6)_50%,transparent_100%)]" />
      
      {/* Absolute background covering the gradient except for the 1px border */}
      <div className="absolute inset-[1px] rounded-[9px] bg-gradient-to-tr from-pm-ink-900 to-pm-accent" />
      
      {/* Top right subtle reflection */}
      <div className="absolute inset-[1px] rounded-[9px] bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
      
      <svg viewBox="0 0 24 24" fill="none" className="relative z-10 h-3.5 w-3.5 text-pm-bg drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </div>
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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('pm_region', region)
    } catch {
      // Ignore storage failures.
    }
  }, [region])

  const navLinks = useMemo(() => ([
    {
      href: `/${region}/calculator`,
      label: 'See What You Can Book',
      activePrefixes: [`/${region}/calculator`, `/${region}/award-search`, `/${region}/inspire`],
    },
    {
      href: `/${region}/trip-builder`,
      label: 'Build My Plan',
      activePrefixes: [`/${region}/trip-builder`, `/${region}/trips`],
    },
    {
      href: `/${region}/card-recommender`,
      label: 'Card Strategy',
      activePrefixes: [`/${region}/card-recommender`, `/${region}/cards`],
    },
    {
      href: `/${region}/profile`,
      label: 'Wallet',
      activePrefixes: [`/${region}/profile`],
    },
  ]), [region])

  const profileName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'
  const avatarLetter = profileName.charAt(0).toUpperCase()

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-all duration-300 ease-in-out"
      style={{
        height: 'var(--navbar-height)',
        background: scrolled ? 'var(--pm-bg)' : 'transparent',
        backdropFilter: scrolled ? 'blur(24px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(24px)' : 'none',
        backgroundColor: scrolled ? 'rgba(var(--pm-bg-rgb), 0.8)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--pm-border-strong)' : '1px solid transparent',
      }}
    >
      <div className="pm-shell flex h-full items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href={`/${region}`} className="inline-flex items-center gap-3 text-pm-ink-900 group">
            <PMLogoMark />
            <div className="hidden sm:block">
              <span className="block text-[1.1rem] font-bold tracking-[-0.04em] transition-colors group-hover:text-pm-accent">PointsMax</span>
              <span className="hidden text-[0.63rem] font-semibold uppercase tracking-[0.2em] text-pm-ink-500 lg:block">
                Wallet-aware booking execution
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = link.activePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 text-[0.85rem] font-medium transition-colors ${isActive ? 'bg-pm-surface-soft text-pm-ink-900' : 'text-pm-ink-700 hover:bg-pm-surface hover:text-pm-ink-900'}`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-pm-surface-soft text-pm-ink-500 transition-colors hover:bg-pm-surface hover:border-pm-border hover:text-pm-ink-900"
            aria-label="Toggle theme"
            type="button"
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="hidden lg:flex items-center gap-2">
            {loading ? (
              <div className="h-10 w-28 animate-pulse rounded-full bg-pm-surface-soft" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setAccountOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-full border border-pm-border bg-pm-surface px-2 py-1.5 text-sm text-pm-ink-700 transition-colors hover:bg-pm-surface-soft"
                  type="button"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pm-accent text-xs font-semibold text-pm-bg">
                    {avatarLetter}
                  </span>
                  <span className="max-w-32 truncate">{profileName}</span>
                  <ChevronDown className="h-4 w-4 text-pm-ink-500" />
                </button>

                {accountOpen && (
                  <div className="absolute right-0 top-full mt-3 w-64 pm-card p-2 shadow-soft">
                    <p className="truncate border-b border-pm-border px-3 py-2 text-xs text-pm-ink-500">{profileName}</p>
                    <Link
                      href={`/${region}/profile`}
                      onClick={() => setAccountOpen(false)}
                      className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-medium text-pm-ink-900 transition-colors hover:bg-pm-surface-soft"
                    >
                      Profile &amp; Settings
                    </Link>
                    <button
                      onClick={() => {
                        setAccountOpen(false)
                        signOut()
                      }}
                      className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-pm-danger transition-colors hover:bg-pm-danger-soft"
                      type="button"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => signInWithGoogle()} className="pm-button px-5 py-2 text-sm" type="button">
                Login
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setMenuOpen((v) => !v)
              setAccountOpen(false)
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-pm-border bg-pm-surface text-pm-ink-700 lg:hidden"
            aria-label="Toggle menu"
            type="button"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-pm-border bg-pm-surface/95 backdrop-blur-xl lg:hidden shadow-soft">
          <div className="pm-shell space-y-3 py-5">
            <div className="flex w-fit items-center gap-1 rounded-full border border-pm-border bg-pm-surface-soft p-1">
              <Link
                href="/us"
                onClick={() => setMenuOpen(false)}
                className={`rounded-full px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${region === 'us' ? 'bg-pm-ink-900 text-pm-bg' : 'text-pm-ink-500 hover:text-pm-ink-900'}`}
              >
                US
              </Link>
              <Link
                href="/in"
                onClick={() => setMenuOpen(false)}
                className={`rounded-full px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${region === 'in' ? 'bg-pm-ink-900 text-pm-bg' : 'text-pm-ink-500 hover:text-pm-ink-900'}`}
              >
                India
              </Link>
            </div>

            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-[20px] px-4 py-3 text-sm font-medium ${link.activePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ? 'bg-pm-ink-900 text-pm-bg shadow-sm' : 'bg-pm-surface-soft text-pm-ink-700 hover:bg-pm-surface-raised hover:text-pm-ink-900 hover:shadow-sm transition-all'}`}
              >
                {link.label}
              </Link>
            ))}

            <div className="border-t border-pm-border pt-4 mt-2">
              {loading ? (
                <div className="h-10 rounded-[20px] bg-pm-surface-soft animate-pulse" />
              ) : user ? (
                <div className="space-y-2">
                  <Link
                    href={`/${region}/profile`}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-[20px] bg-pm-surface-soft px-4 py-3 text-sm font-medium text-pm-ink-700 hover:bg-pm-surface-raised hover:text-pm-ink-900 hover:shadow-sm transition-all"
                  >
                    Profile &amp; Settings
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      signOut()
                    }}
                    className="w-full rounded-[20px] bg-pm-surface-soft px-4 py-3 text-left text-sm font-medium text-pm-danger hover:bg-pm-danger-soft transition-all"
                    type="button"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button onClick={() => signInWithGoogle()} className="pm-button w-full justify-center px-4 py-3 text-sm" type="button">
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
