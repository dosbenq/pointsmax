'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import NavBar from '@/components/NavBar'

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/programs', label: 'Programs & CPP' },
  { href: '/admin/bonuses', label: 'Transfer Bonuses' },
  { href: '/admin/link-health', label: 'Link Health' },
  { href: '/admin/creators', label: 'Creators' },
  { href: '/admin/catalog-health', label: 'Catalog Health' },
  { href: '/admin/audit-log', label: 'Audit Log' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/workflow-health', label: 'Workflow Health' },
]

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isAdmin = !!ADMIN_EMAIL && user?.email === ADMIN_EMAIL

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace('/')
    }
  }, [loading, user, isAdmin, router])

  if (loading || !user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-slate-700 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 border-r border-slate-200 bg-white px-3 py-8 flex-shrink-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-3">
            Admin
          </p>
          <nav className="space-y-0.5">
            {NAV.map(item => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-medium'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 bg-slate-50 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
