'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { PlaneTakeoff, CreditCard } from 'lucide-react'
import type { Region } from '@/lib/regions'

export function HeroSection({ region }: { region: Region }) {
  return (
    <div className="relative z-10 pm-shell flex-1 flex flex-col justify-center items-center text-center py-20 pb-32">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-4xl mx-auto"
      >
        <h1 className="pm-display text-[4rem] sm:text-[5.5rem] lg:text-[6.5rem] leading-[1] tracking-[-0.04em] text-pm-ink-900 drop-shadow-sm">
          Turn your credit card points into{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-pm-accent to-blue-500">
            dream flights.
          </span>
        </h1>
        <p className="mt-8 text-xl sm:text-2xl text-pm-ink-500 max-w-2xl mx-auto font-medium leading-relaxed tracking-[-0.02em]">
          See what your points can actually book, compare the smartest transfer paths, and get a
          clear next-step plan for turning your wallet into real trips.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-lg mx-auto"
      >
        <Link
          href={`/${region}/calculator`}
          className="w-full sm:w-auto px-8 py-4 bg-pm-ink-900 hover:bg-pm-accent text-pm-bg rounded-2xl text-lg font-semibold transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.1)] hover:shadow-glow flex items-center justify-center gap-2 group"
        >
          See What You Can Book
          <PlaneTakeoff className="w-5 h-5 transition-transform group-hover:scale-110" />
        </Link>
        <Link
          href={`/${region}/card-recommender`}
          className="w-full sm:w-auto px-8 py-4 bg-pm-surface-soft hover:bg-pm-surface-raised border border-pm-border text-pm-ink-900 rounded-2xl text-lg font-semibold transition-all duration-300 hover:border-pm-accent-border flex items-center justify-center gap-2 group shadow-xs hover:shadow-sm"
        >
          Match a Card
          <CreditCard className="w-5 h-5 text-pm-ink-500 group-hover:text-pm-accent transition-colors" />
        </Link>
      </motion.div>
    </div>
  )
}
