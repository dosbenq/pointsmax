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
    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#9fe4df]/26 bg-[linear-gradient(145deg,#0f5972_0%,#137f8f_100%)] text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-[#f4fbff] shadow-[0_18px_32px_rgba(10,50,82,0.2)]">
      PM
    </span>
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
    { href: `/${region}/calculator`, label: 'Planner' },
    { href: `/${region}/card-recommender`, label: 'Card Strategy' },
    { href: `/${region}/profile`, label: 'Wallet' },
  ]), [region])

  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-all duration-200"
      style={{
        height: 'var(--navbar-height)',
        background: scrolled ? 'rgba(241, 250, 252, 0.88)' : 'rgba(241, 250, 252, 0.64)',
        backdropFilter: 'blur(24px)',
        borderBottom: scrolled ? '1px solid rgba(17, 54, 86, 0.08)' : '1px solid transparent',
      }}
    >
      <div className="pm-shell flex h-full items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Link href={`/${region}`} className="inline-flex items-center gap-3 text-pm-ink-900">
            <PMLogoMark />
            <div>
              <span className="block text-[1.02rem] font-semibold tracking-[-0.04em]">PointsMax</span>
              <span className="block text-[0.62rem] uppercase tracking-[0.24em] text-pm-ink-500">Rewards concierge</span>
            </div>
          </Link>

          <nav className="hidden xl:flex items-center gap-6 rounded-full border border-[#113656]/8 bg-[#f6fbfd]/78 px-3 py-2 shadow-[0_12px_30px_rgba(10,50,82,0.06)]">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] transition-colors ${isActive ? 'bg-[linear-gradient(145deg,#0f5972_0%,#177dc7_100%)] text-[#f4fbff]' : 'text-pm-ink-500 hover:text-pm-ink-900'}`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex items-center gap-1 rounded-full border border-[#113656]/8 bg-[#f6fbfd]/78 p-1 shadow-[0_12px_30px_rgba(10,50,82,0.05)]">
            <Link
              href="/us"
              className={`rounded-full px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] transition-colors ${region === 'us' ? 'bg-[linear-gradient(145deg,#0f5972_0%,#177dc7_100%)] text-[#f4fbff]' : 'text-pm-ink-500 hover:text-pm-ink-900'}`}
            >
              US
            </Link>
            <Link
              href="/in"
              className={`rounded-full px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] transition-colors ${region === 'in' ? 'bg-[linear-gradient(145deg,#0f5972_0%,#177dc7_100%)] text-[#f4fbff]' : 'text-pm-ink-500 hover:text-pm-ink-900'}`}
            >
              India
            </Link>
          </div>

          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#113656]/8 bg-[#f6fbfd]/80 text-pm-ink-500 transition-colors hover:text-pm-ink-900"
            aria-label="Toggle theme"
            type="button"
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <div className="hidden lg:flex items-center gap-2">
            {loading ? (
              <div className="h-10 w-28 animate-pulse rounded-full bg-[#f8fbff]/74" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setAccountOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#113656]/8 bg-[#f6fbfd]/80 px-2 py-1.5 text-sm text-pm-ink-700 transition-colors hover:bg-[#ffffff]/94"
                  type="button"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(145deg,#0f5972_0%,#177dc7_100%)] text-xs font-semibold text-[#f4fbff] dark:bg-[#f8fbff] dark:text-[#10243a]">
                    {avatarLetter}
                  </span>
                  <span className="max-w-32 truncate">{user.email}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-pm-ink-500" />
                </button>

                {accountOpen && (
                  <div className="absolute right-0 top-full mt-3 w-64 pm-card p-2">
                    <p className="truncate border-b border-pm-border px-3 py-2 text-xs text-pm-ink-500">{user.email}</p>
                    <Link
                      href={`/${region}/profile`}
                      onClick={() => setAccountOpen(false)}
                      className="mt-1 block rounded-2xl px-3 py-2.5 text-sm text-pm-ink-900 transition-colors hover:bg-pm-surface-soft"
                    >
                      Profile &amp; Settings
                    </Link>
                    <button
                      onClick={() => {
                        setAccountOpen(false)
                        signOut()
                      }}
                      className="w-full rounded-2xl px-3 py-2.5 text-left text-sm text-pm-danger transition-colors hover:bg-pm-danger-soft"
                      type="button"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={signInWithGoogle} className="pm-button px-5 py-2.5 text-sm" type="button">
                Start free
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setMenuOpen((v) => !v)
              setAccountOpen(false)
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#113656]/8 bg-[#f6fbfd]/80 text-pm-ink-700 lg:hidden"
            aria-label="Toggle menu"
            type="button"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-pm-border bg-[#eef9fb]/95 backdrop-blur-xl lg:hidden">
          <div className="pm-shell space-y-3 py-5">
            <div className="flex w-fit items-center gap-1 rounded-full border border-[#113656]/8 bg-[#f6fbfd]/80 p-1">
              <Link
                href="/us"
                onClick={() => setMenuOpen(false)}
                className={`rounded-full px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${region === 'us' ? 'bg-[linear-gradient(145deg,#0f5972_0%,#177dc7_100%)] text-[#f4fbff]' : 'text-pm-ink-500'}`}
              >
                US
              </Link>
              <Link
                href="/in"
                onClick={() => setMenuOpen(false)}
                className={`rounded-full px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] ${region === 'in' ? 'bg-[linear-gradient(145deg,#0f5972_0%,#177dc7_100%)] text-[#f4fbff]' : 'text-pm-ink-500'}`}
              >
                India
              </Link>
            </div>

            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-[22px] px-4 py-3 text-sm font-medium ${pathname === link.href ? 'bg-[linear-gradient(145deg,#0f5972_0%,#177dc7_100%)] text-[#f4fbff]' : 'bg-[#f6fbfd]/80 text-pm-ink-700 hover:bg-[#ffffff]/94'}`}
              >
                {link.label}
              </Link>
            ))}

            <div className="border-t border-pm-border pt-3">
              {loading ? (
                <div className="h-10 rounded-2xl bg-[#f6fbfd]/80 animate-pulse" />
              ) : user ? (
                <div className="space-y-2">
                  <Link
                    href={`/${region}/profile`}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-[22px] bg-[#f6fbfd]/80 px-4 py-3 text-sm font-medium text-pm-ink-700 hover:bg-[#ffffff]/94"
                  >
                    Profile &amp; Settings
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      signOut()
                    }}
                    className="w-full rounded-[22px] bg-[#f6fbfd]/80 px-4 py-3 text-left text-sm font-medium text-pm-danger hover:bg-pm-danger-soft"
                    type="button"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <button onClick={signInWithGoogle} className="pm-button w-full justify-center py-3 text-sm" type="button">
                  Start free
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
