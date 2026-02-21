'use client'

import { useState } from 'react'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import Footer from '@/components/Footer'

const STEPS = [
  {
    number: '01',
    title: 'Enter your balances',
    description:
      'Add balances from all your loyalty programs — Chase Ultimate Rewards, Amex Membership Rewards, airline miles, hotel points, and more. PointsMax supports 20+ programs across transferable currencies, airlines, and hotels.',
    detail: 'Signed-in users can save their balances for instant access on future visits.',
  },
  {
    number: '02',
    title: 'See ranked redemptions',
    description:
      'Our calculation engine evaluates every possible redemption option for your wallet — including transfer partners — and ranks them by total dollar value using current cents-per-point (CPP) valuations.',
    detail: 'Valuations are sourced from The Points Guy (TPG) and updated monthly.',
  },
  {
    number: '03',
    title: 'Book with AI guidance',
    description:
      "Tell our AI advisor where you want to go and when. It builds a complete, step-by-step booking plan tailored to your specific balances, preferred cabin, and airline preferences — including which cards to transfer from and how.",
    detail: 'Powered by Google Gemini with fair-use request limits.',
  },
]

const PROGRAMS = [
  { name: 'Chase Ultimate Rewards', type: 'Transferable Points' },
  { name: 'Amex Membership Rewards', type: 'Transferable Points' },
  { name: 'Capital One Miles', type: 'Transferable Points' },
  { name: 'Citi ThankYou Points', type: 'Transferable Points' },
  { name: 'Bilt Rewards', type: 'Transferable Points' },
  { name: 'United MileagePlus', type: 'Airline Miles' },
  { name: 'Delta SkyMiles', type: 'Airline Miles' },
  { name: 'American AAdvantage', type: 'Airline Miles' },
  { name: 'Air Canada Aeroplan', type: 'Airline Miles' },
  { name: 'British Avios', type: 'Airline Miles' },
  { name: 'Air France Flying Blue', type: 'Airline Miles' },
  { name: 'Alaska Mileage Plan', type: 'Airline Miles' },
  { name: 'Singapore KrisFlyer', type: 'Airline Miles' },
  { name: 'World of Hyatt', type: 'Hotel Points' },
  { name: 'Marriott Bonvoy', type: 'Hotel Points' },
  { name: 'Hilton Honors', type: 'Hotel Points' },
  { name: 'IHG One Rewards', type: 'Hotel Points' },
  { name: 'Wyndham Rewards', type: 'Hotel Points' },
]

const FAQ = [
  {
    q: 'How are CPP values calculated?',
    a: 'We use The Points Guy (TPG) valuations, updated monthly. CPP (cents per point) reflects the real-world value you can realistically achieve on aspirational redemptions like business class flights and luxury hotels — not cash-back rates.',
  },
  {
    q: 'Is PointsMax really free?',
    a: 'Yes. The points calculator, all 20+ programs, award flight search, and the AI advisor are free to use. No credit card and no trial period.',
  },
  {
    q: 'How does the AI advisor work?',
    a: "The AI advisor is powered by Google Gemini. It receives your points balances, top redemption options, and travel preferences, then generates personalized booking plans in a structured format — including specific airlines, routes, points needed, and step-by-step booking instructions. Fair-use request limits apply.",
  },
  {
    q: 'What is an award chart?',
    a: "An award chart is a table published by an airline or hotel program that shows how many points are required to book a reward. Some programs use dynamic pricing instead of fixed award charts. PointsMax uses chart-based estimates where applicable and live data from Seats.aero for real availability.",
  },
  {
    q: 'When will Pro launch?',
    a: "We're rolling out Pro in phases. Join the waitlist to get launch updates, early access, and pricing details.",
  },
]

export default function HowItWorksPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />

      <section className="border-b border-[#d7e8dd] bg-[rgba(236,246,240,0.52)] py-14 sm:py-16">
        <div className="pm-shell text-center">
          <span className="pm-pill mb-4">Clear process, real outcomes</span>
          <h1 className="pm-heading text-4xl sm:text-5xl mb-4">
            How PointsMax works
          </h1>
          <p className="pm-subtle text-lg max-w-2xl mx-auto">
            A simple, three-step process to unlock the hidden value in your loyalty points.
          </p>
        </div>
      </section>

      <main className="flex-1 pm-shell py-14 sm:py-16 space-y-16 sm:space-y-20">

        <section className="space-y-14">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className={`flex flex-col sm:flex-row gap-8 items-start ${i % 2 === 1 ? 'sm:flex-row-reverse' : ''}`}
            >
              <div className="sm:w-1/3 flex-shrink-0">
                <div className="pm-card-soft p-8 text-center">
                  <p className="text-6xl font-semibold text-[#d6e5dc] leading-none">{step.number}</p>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="pm-heading text-2xl mb-3">{step.title}</h2>
                <p className="text-[#2d4f42] leading-relaxed mb-3">{step.description}</p>
                <p className="text-sm text-[#5f7c70]">{step.detail}</p>
              </div>
            </div>
          ))}
        </section>

        <section>
          <h2 className="pm-heading text-2xl mb-2">Programs we cover</h2>
          <p className="pm-subtle mb-6">20+ loyalty programs across transferable points, airline miles, and hotel rewards.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROGRAMS.map((p) => (
              <div key={p.name} className="pm-card px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-[#244437]">{p.name}</span>
                <span className="text-xs text-[#6a8579] flex-shrink-0 ml-3">{p.type}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="pm-heading text-2xl mb-8">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="pm-card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#f6fbf8] transition-colors"
                >
                  <span className="font-semibold text-[#173f34] text-sm pr-4">{item.q}</span>
                  <span className="text-[#688477] text-xs flex-shrink-0">{openFaq === i ? '▲' : '▼'}</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 border-t border-[#e2ece6]">
                    <p className="text-sm text-[#5f7c70] leading-relaxed pt-3">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="pm-card-soft p-8 sm:p-10 text-center">
          <h2 className="pm-heading text-2xl mb-2">Ready to get started?</h2>
          <p className="pm-subtle mb-6">It only takes 30 seconds to enter your balances and see your results.</p>
          <Link href="/calculator" className="pm-button">
            Calculate my points
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  )
}
