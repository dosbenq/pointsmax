'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { getRegionFromPath } from '@/lib/regions'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

export default function NavBar() {
  const { user, signInWithGoogle, signOut, loading } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const pathname = usePathname()
  const region = getRegionFromPath(pathname)
  
  const [toolsOpen, setToolsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const navLinks = useMemo(() => ([
    { href: `/${region}/calculator`, label: 'Calculator' },
    { href: `/${region}/how-it-works`, label: 'How it works' },
    { href: `/${region}/pricing`, label: 'Pricing' },
  ]), [region])

  const toolLinks = useMemo(() => ([
    { href: `/${region}/award-search`, label: 'Award Search', desc: 'Quick route and availability scan' },
    { href: `/${region}/inspire`, label: 'Inspire Me', desc: 'Find destinations from your wallet' },
    { href: `/${region}/earning-calculator`, label: 'Earning Calculator', desc: 'Optimize monthly card earnings' },
    { href: `/${region}/card-recommender`, label: 'Card Recommender', desc: 'Choose the best next card' },
    { href: `/${region}/trip-builder`, label: 'Trip Builder', desc: 'Generate a full points plan' },
  ]), [region])

  const isToolsActive = useMemo(
    () => toolLinks.some((item) => pathname === item.href),
    [pathname, toolLinks],
  )

  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <header className="sticky top-0 z-50 backdrop-blur border-b border-pm-border/90 bg-pm-bg/90">
      <div className="pm-shell h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/${region}`}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 border border-pm-border bg-pm-surface text-pm-ink-900 hover:bg-pm-surface-soft transition-colors"
          >
            <span className="inline-flex w-6 h-6 rounded-full bg-pm-accent text-white items-center justify-center text-xs font-bold">P</span>
            <span className="text-sm font-semibold tracking-wide">PointsMax</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-full text-sm transition-colors ${
                    isActive
                      ? 'bg-pm-accent-soft text-pm-accent-strong font-semibold'
                      : 'text-pm-ink-700 hover:bg-pm-surface hover:text-pm-ink-900'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}

            <div className="relative">
              <button
                onClick={() => setToolsOpen((v) => !v)}
                className={`px-3 py-2 rounded-full text-sm transition-colors flex items-center gap-1 ${
                  isToolsActive
                    ? 'bg-pm-accent-soft text-pm-accent-strong font-semibold'
                    : 'text-pm-ink-700 hover:bg-pm-surface hover:text-pm-ink-900'
                }`}
              >
                Tools
                <span className="text-xs">▾</span>
              </button>

              {toolsOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 pm-card p-2 shadow-2xl">
                  {toolLinks.map((tool) => (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      onClick={() => setToolsOpen(false)}
                      className={`block rounded-xl px-3 py-2.5 transition-colors ${
                        pathname === tool.href ? 'bg-pm-accent-soft' : 'hover:bg-pm-surface-soft'
                      }`}
                    >
                      <p className="text-sm font-semibold text-pm-ink-900">{tool.label}</p>
                      <p className="text-xs text-pm-ink-500 mt-0.5">{tool.desc}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-pm-border bg-pm-surface hover:bg-pm-surface-soft transition-colors"
            aria-label="Toggle theme"
            type="button"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-4 w-4 text-pm-ink-700" />
            ) : (
              <Moon className="h-4 w-4 text-pm-ink-700" />
            )}
          </button>

          <button
            onClick={() => {
              setMenuOpen((v) => !v)
              setToolsOpen(false)
              setAccountOpen(false)
            }}
            className="md:hidden pm-button-secondary px-3 py-2"
            aria-label="Toggle menu"
          >
            ☰
          </button>

          {loading ? (
            <div className="w-8 h-8 rounded-full bg-pm-border animate-pulse" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => {
                  setAccountOpen((v) => !v)
                  setToolsOpen(false)
                  setMenuOpen(false)
                }}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-pm-border bg-pm-surface hover:bg-pm-surface-soft transition-colors"
              >
                <span className="w-7 h-7 rounded-full bg-pm-accent text-white text-xs font-bold flex items-center justify-center">
                  {avatarLetter}
                </span>
                <span className="hidden sm:block text-xs text-pm-ink-700 max-w-40 truncate">{user.email}</span>
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
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-red-50 text-pm-danger"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={signInWithGoogle} className="pm-button">
              Start free
            </button>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-pm-border bg-pm-bg/96">
          <div className="pm-shell py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-xl px-3 py-2 text-sm ${
                  pathname === link.href
                    ? 'bg-pm-accent-soft text-pm-accent-strong font-semibold'
                    : 'text-pm-ink-700 hover:bg-pm-surface'
                }`}
              >
                {link.label}
              </Link>
            ))}

            <p className="px-3 pt-2 text-[11px] uppercase tracking-wider text-pm-ink-500">Tools</p>
            {toolLinks.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-xl px-3 py-2 ${
                  pathname === tool.href ? 'bg-pm-accent-soft' : 'hover:bg-pm-surface'
                }`}
              >
                <p className="text-sm font-medium text-pm-ink-900">{tool.label}</p>
                <p className="text-xs text-pm-ink-500">{tool.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(toolsOpen || accountOpen) && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => {
            setToolsOpen(false)
            setAccountOpen(false)
          }}
        />
      )}
    </header>
  )
}
