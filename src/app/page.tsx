'use client'

import Link from 'next/link'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'
import { useAuth } from '@/lib/auth-context'

const PROGRAMS = [
  'Chase UR', 'Amex MR', 'Capital One', 'Citi TY', 'Bilt',
  'United', 'Delta', 'American', 'Aeroplan', 'Avios',
  'Flying Blue', 'Alaska', 'Singapore KrisFlyer',
  'Hyatt', 'Marriott', 'Hilton', 'IHG', 'Wyndham',
]

const STEPS = [
  {
    number: '01',
    title: 'Enter your balances',
    description: 'Add all your points across Chase, Amex, Capital One, airlines, and hotels. We support 20+ programs.',
  },
  {
    number: '02',
    title: 'See ranked redemptions',
    description: 'Our engine calculates the exact cents-per-point value for every redemption option, ranked by total value.',
  },
  {
    number: '03',
    title: 'Book with AI guidance',
    description: 'Tell our AI advisor where you want to go. It builds a step-by-step booking plan tailored to your wallet.',
  },
]

const FEATURES = [
  {
    title: 'Real CPP Valuations',
    description: 'Every program rated by certified cents-per-point using TPG data, updated monthly.',
  },
  {
    title: 'Transfer Partner Mapping',
    description: 'Instantly see which transferable currencies can reach any airline or hotel program.',
  },
  {
    title: 'Award Flight Search',
    description: 'Search award space using chart estimates or live availability data from Seats.aero.',
  },
  {
    title: 'AI Travel Advisor',
    description: 'Multi-turn AI powered by Gemini that builds personalized, step-by-step redemption plans.',
  },
]

const FREE_FEATURES = [
  'Full points calculator',
  '20+ programs',
  '3 AI advisor messages/session',
  'Award flight search',
  'Save balances & preferences',
]

const PRO_FEATURES = [
  'Everything in Free',
  'Unlimited AI advisor',
  'Live award availability',
  'Price alerts',
  'Priority support',
]

export default function LandingPage() {
  const { user, signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="bg-white pt-20 pb-24">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-sm text-slate-500 mb-5">Free · No account required</p>

          <h1 className="text-5xl sm:text-6xl font-semibold text-slate-900 tracking-tight leading-tight mb-6">
            Your points are worth<br />more than you think.
          </h1>

          <p className="text-xl text-slate-500 max-w-xl mx-auto mb-10">
            Most people leave 40–60% of their value on the table. Find out exactly what you&apos;re missing.
          </p>

          <div className="flex items-center justify-center gap-5 flex-wrap">
            <Link
              href="/calculator"
              className="bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-6 py-3 rounded-full transition-colors"
            >
              Calculate my points
            </Link>
            <Link
              href="/how-it-works"
              className="text-sm text-slate-900 underline underline-offset-4 hover:text-slate-600 transition-colors"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* ── SAMPLE RESULT ─────────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-200 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs text-slate-400 uppercase tracking-widest text-center mb-8">Sample · 80,000 Chase UR</p>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden max-w-sm mx-auto">
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
              <span className="text-sm text-slate-500">Cash value</span>
              <span className="text-sm font-semibold text-slate-900">$800</span>
            </div>
            <div className="px-6 py-4 flex items-center justify-between bg-slate-900">
              <span className="text-sm text-white">Best value</span>
              <span className="text-sm font-semibold text-white">$2,000</span>
            </div>
            <div className="px-6 py-4 flex items-center justify-between">
              <span className="text-sm text-slate-500">Extra value</span>
              <span className="text-sm font-semibold text-emerald-600">+$1,200</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROGRAM STRIP ─────────────────────────────────────── */}
      <section className="bg-white py-12 border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold text-slate-900 mb-4">20+ programs supported</p>
          <p className="text-sm text-slate-400">
            {PROGRAMS.join(', ')}
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────── */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight text-center mb-14">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map(step => (
              <div key={step.number}>
                <p className="text-5xl font-semibold text-slate-100 mb-4 leading-none">{step.number}</p>
                <h3 className="font-semibold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ─────────────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-200 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight text-center mb-14">
            Everything you need
          </h2>
          <div className="grid sm:grid-cols-2 gap-10">
            {FEATURES.map(f => (
              <div key={f.title}>
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING TEASER ────────────────────────────────────── */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight text-center mb-14">
            Free to start. Always.
          </h2>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Free */}
            <div className="border border-slate-200 rounded-2xl p-8">
              <p className="text-sm font-semibold text-slate-500 mb-1">Free</p>
              <p className="text-4xl font-semibold text-slate-900 mb-6">
                $0<span className="text-lg font-normal text-slate-400">/mo</span>
              </p>
              <ul className="space-y-2 text-sm text-slate-600 mb-8">
                {FREE_FEATURES.map(f => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link
                href="/calculator"
                className="block text-center bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2.5 rounded-full transition-colors"
              >
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div className="border border-slate-200 rounded-2xl p-8 relative">
              <span className="absolute top-4 right-4 text-xs bg-slate-100 text-slate-400 rounded-full px-2.5 py-0.5">
                Soon
              </span>
              <p className="text-sm font-semibold text-indigo-600 mb-1">Pro</p>
              <p className="text-4xl font-semibold text-slate-900 mb-6">
                $9<span className="text-lg font-normal text-slate-400">/mo</span>
              </p>
              <ul className="space-y-2 text-sm text-slate-600 mb-8">
                {PRO_FEATURES.map(f => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link
                href="/pricing"
                className="block text-center border border-slate-200 text-slate-700 hover:border-slate-300 text-sm font-medium px-4 py-2.5 rounded-full transition-colors"
              >
                Join waitlist
              </Link>
            </div>
          </div>
          <p className="text-center mt-8 text-sm">
            <Link href="/pricing" className="text-indigo-600 hover:underline underline-offset-4">
              See full pricing details
            </Link>
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <section className="bg-slate-50 border-t border-slate-200 py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight mb-4">
            Start finding hidden value.
          </h2>
          <p className="text-slate-500 mb-10">Takes 30 seconds. Free forever.</p>
          {user ? (
            <Link
              href="/calculator"
              className="inline-block bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-8 py-3 rounded-full transition-colors"
            >
              Go to calculator
            </Link>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-8 py-3 rounded-full transition-colors"
            >
              Get started free
            </button>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}
