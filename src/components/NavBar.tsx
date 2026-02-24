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
    <header className="sticky top-0 z-50 backdrop-blur border-b border-[#d5e5d9]/90 bg-[rgba(243,248,243,0.86)]">
      <div className="pm-shell h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/${region}`}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 border border-[#a9d8cf] bg-white text-[#0f3f36] hover:bg-[#f3fbf8] transition-colors"
          >
            <span className="inline-flex w-6 h-6 rounded-full bg-[#0f766e] text-white items-center justify-center text-xs font-bold">P</span>
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
                      ? 'bg-[#def4ef] text-[#0f5f57] font-semibold'
                      : 'text-[#365649] hover:bg-white hover:text-[#143d33]'
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
                    ? 'bg-[#def4ef] text-[#0f5f57] font-semibold'
                    : 'text-[#365649] hover:bg-white hover:text-[#143d33]'
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
                        pathname === tool.href ? 'bg-[#e8f6f1]' : 'hover:bg-[#f4faf7]'
                      }`}
                    >
                      <p className="text-sm font-semibold text-[#153d32]">{tool.label}</p>
                      <p className="text-xs text-[#5b776a] mt-0.5">{tool.desc}</p>
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#c5ddd1] bg-white hover:bg-[#f4faf7] transition-colors"
            aria-label="Toggle theme"
            type="button"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-4 w-4 text-[#365649]" />
            ) : (
              <Moon className="h-4 w-4 text-[#365649]" />
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
            <div className="w-8 h-8 rounded-full bg-[#dce9e1] animate-pulse" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => {
                  setAccountOpen((v) => !v)
                  setToolsOpen(false)
                  setMenuOpen(false)
                }}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-[#c5ddd1] bg-white hover:bg-[#f4faf7] transition-colors"
              >
                <span className="w-7 h-7 rounded-full bg-[#0f766e] text-white text-xs font-bold flex items-center justify-center">
                  {avatarLetter}
                </span>
                <span className="hidden sm:block text-xs text-[#426457] max-w-40 truncate">{user.email}</span>
              </button>

              {accountOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 pm-card p-2 shadow-2xl">
                  <p className="px-3 py-2 text-xs text-[#5b776a] border-b border-[#e1ece6] truncate">{user.email}</p>
                  <Link
                    href="/profile"
                    onClick={() => setAccountOpen(false)}
                    className="block px-3 py-2 text-sm rounded-lg hover:bg-[#f3faf6] text-[#1b4438]"
                  >
                    Profile &amp; Settings
                  </Link>
                  <button
                    onClick={() => {
                      setAccountOpen(false)
                      signOut()
                    }}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-[#fff4f3] text-[#b42318]"
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
        <div className="md:hidden border-t border-[#dbe9e1] bg-[rgba(243,248,243,0.96)]">
          <div className="pm-shell py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-xl px-3 py-2 text-sm ${
                  pathname === link.href
                    ? 'bg-[#def4ef] text-[#0f5f57] font-semibold'
                    : 'text-[#2f5548] hover:bg-white'
                }`}
              >
                {link.label}
              </Link>
            ))}

            <p className="px-3 pt-2 text-[11px] uppercase tracking-wider text-[#6a8579]">Tools</p>
            {toolLinks.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                onClick={() => setMenuOpen(false)}
                className={`block rounded-xl px-3 py-2 ${
                  pathname === tool.href ? 'bg-[#e8f6f1]' : 'hover:bg-white'
                }`}
              >
                <p className="text-sm font-medium text-[#183e33]">{tool.label}</p>
                <p className="text-xs text-[#648274]">{tool.desc}</p>
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
