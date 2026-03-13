'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, PlaneTakeoff, Sparkles, MapPin, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { AirportAutocomplete } from '@/components/AirportAutocomplete'
import { createBrowserClient } from '@supabase/ssr'

type OnboardingStep = 0 | 1 | 2

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [step, setStep] = useState<OnboardingStep>(0)
  const [loading, setLoading] = useState(false)
  const [supabase] = useState(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { storageKey: 'pm-auth-token-v2', debug: false } }
  ))

  const params = useParams()
  const region = (params?.region as string) || 'us'
  
  // Step 1: Airport
  const [homeAirport, setHomeAirport] = useState('')
  
  // Step 2: Simplified balances
  const [card1Points, setCard1Points] = useState('')
  const [card2Points, setCard2Points] = useState('')
  
  const card1Slug = region === 'in' ? 'hdfc_rewards' : 'chase_ur'
  const card2Slug = region === 'in' ? 'axis_edge' : 'amex_mr'
  const card1Name = region === 'in' ? 'HDFC Reward Points' : 'Chase Ultimate Rewards'
  const card2Name = region === 'in' ? 'Axis Edge Rewards' : 'Amex Membership Rewards'
  const card1Url = region === 'in' ? 'https://www.hdfcbank.com/content/api/contentstream-id/723fb80a-2dde-42a3-9793-7ae1be57c87f/c6f7b11d-28b9-4467-9aa2-ecb79f22849b?' : 'https://creditcards.chase.com/K-OPPORTUNITY/images/cardart/sapphire_preferred.png'
  const card2Url = region === 'in' ? 'https://www.axisbank.com/images/default-source/revamp_new/cards/credit-cards/axis-bank-atlas-credit-card/axis-bank-atlas-credit-card.png' : 'https://icm.aexp-static.com/Internet/Acquisition/US_en/Appleseed/EquipmentFronts/1-1-1/Gold.png'

  // Check if we should skip
  useEffect(() => {
    async function checkOnboardingStatus() {
      if (authLoading) return

      if (!user) {
        router.push(`/${region}/calculator`)
        return
      }

      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('home_airport')
        .eq('id', user.id)
        .single()
        
        if (prefs?.home_airport) {
          // User already has a home airport, redirect to calculator
          router.push(`/${region}/calculator?origin=${prefs.home_airport}`)
        }
      }
      
      checkOnboardingStatus()
    }, [user, authLoading, router, supabase, region])

  const handleComplete = async () => {
    setLoading(true)
    
    try {
       // 1. Save Home Airport to preferences
       if (homeAirport) {
         await supabase
            .from('user_preferences')
            .upsert({ 
               id: user!.id,
               home_airport: homeAirport.toUpperCase()
            }, { onConflict: 'id' })
       }

       // 2. Insert mocked points if provided
       const balancesToInsert = []
       
       if (card1Points && parseInt(card1Points.replace(/\D/g, '')) > 0) {
         const { data: cpp } = await supabase.from('programs').select('id').eq('slug', card1Slug).single()
         if (cpp) {
           balancesToInsert.push({
             user_id: user!.id,
             program_id: cpp.id,
             balance: parseInt(card1Points.replace(/\D/g, '')),
             source: 'manual'
           })
         }
       }
       
       if (card2Points && parseInt(card2Points.replace(/\D/g, '')) > 0) {
         const { data: mr } = await supabase.from('programs').select('id').eq('slug', card2Slug).single()
         if (mr) {
           balancesToInsert.push({
             user_id: user!.id,
             program_id: mr.id,
             balance: parseInt(card2Points.replace(/\D/g, '')),
             source: 'manual'
           })
         }
       }

       if (balancesToInsert.length > 0) {
          // Wipe existing manual to prevent dupes during onboarding
          await supabase.from('wallet_balances').delete().eq('user_id', user!.id)
          await supabase.from('wallet_balances').insert(balancesToInsert)
       }

       // 3. Mark auth completed & redirect
       router.push(homeAirport ? `/${region}/calculator?origin=${homeAirport.toUpperCase()}` : `/${region}/calculator`)

    } catch (err) {
       console.error("Failed onboarding", err)
       router.push(`/${region}/calculator`)
    }
  }

  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  }

  return (
    <div className="min-h-screen bg-pm-bg flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 z-0 overflow-hidden flex items-center justify-center pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(var(--pm-accent-rgb),0.05)_0%,transparent_60%)] blur-[60px]" />
      </div>

      <div className="w-full max-w-xl relative z-10">
        
        {/* Progress Dots */}
        <div className="flex justify-center gap-3 mb-12">
          {[0, 1, 2].map((i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-500 ${step === i ? 'w-8 bg-pm-accent' : step > i ? 'w-4 bg-pm-accent-soft' : 'w-4 bg-pm-border'}`} 
            />
          ))}
        </div>

        <div className="bg-pm-surface border border-pm-border shadow-2xl rounded-[32px] overflow-hidden min-h-[500px] flex flex-col relative">
           <AnimatePresence mode="wait">
              
              {/* STEP 0: Welcome & Airport */}
              {step === 0 && (
                <motion.div 
                  key="step0"
                  variants={slideVariants}
                  initial="initial" animate="animate" exit="exit"
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="p-10 sm:p-12 flex-1 flex flex-col"
                >
                  <div className="mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-pm-surface-soft border border-pm-border flex items-center justify-center text-pm-ink-900 mb-6 shadow-sm">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <h2 className="pm-display text-4xl mb-3">Where do you live?</h2>
                    <p className="text-pm-ink-500 text-lg">Set your home airport to get instant flight results tailored to you.</p>
                  </div>

                  <div className="mt-4 flex-1">
                     <AirportAutocomplete
                        id="onboard-origin"
                        value={homeAirport}
                        onChange={setHomeAirport}
                        placeholder="Search for an airport"
                        className="w-full py-6 text-xl rounded-2xl border-pm-border-strong shadow-sm bg-pm-surface"
                     />
                  </div>

                  <button 
                    onClick={() => setStep(1)}
                    disabled={!homeAirport}
                    className="pm-button w-full py-5 text-lg mt-8 disabled:opacity-50"
                  >
                    Continue <ArrowRight className="w-5 h-5 ml-2 inline" />
                  </button>
                </motion.div>
              )}

              {/* STEP 1: Quick Wallet */}
              {step === 1 && (
                <motion.div 
                  key="step1"
                  variants={slideVariants}
                  initial="initial" animate="animate" exit="exit"
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="p-10 sm:p-12 flex-1 flex flex-col"
                >
                  <div className="mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-pm-surface-soft border border-pm-border flex items-center justify-center text-pm-ink-900 mb-6 shadow-sm">
                      <span className="text-2xl">💳</span>
                    </div>
                    <h2 className="pm-display text-4xl mb-3">Add your first wallet.</h2>
                    <p className="text-pm-ink-500 text-lg">Credit card points transfer to dozens of airlines. Let&apos;s start with the top two programs.</p>
                  </div>

                  <div className="space-y-4 flex-1">
                     
                     <div className="p-4 rounded-2xl border border-pm-border bg-pm-surface-soft flex items-center gap-4 focus-within:border-pm-accent transition-colors">
                        <div className="w-10 h-10 rounded overflow-hidden">
                           <Image src={card1Url} alt="Card 1" width={60} height={40} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                           <p className="font-semibold pm-heading text-sm">{card1Name}</p>
                        </div>
                        <input 
                           type="text" 
                           inputMode="numeric"
                           placeholder="80,000"
                           value={card1Points}
                           onChange={(e) => setCard1Points(e.target.value)}
                           className="w-24 bg-transparent outline-none text-right font-semibold text-lg"
                        />
                     </div>

                     <div className="p-4 rounded-2xl border border-pm-border bg-pm-surface-soft flex items-center gap-4 focus-within:border-pm-accent transition-colors">
                        <div className="w-10 h-10 rounded overflow-hidden">
                           <Image src={card2Url} alt="Card 2" width={60} height={40} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                           <p className="font-semibold pm-heading text-sm">{card2Name}</p>
                        </div>
                        <input 
                           type="text" 
                           inputMode="numeric"
                           placeholder="60,000"
                           value={card2Points}
                           onChange={(e) => setCard2Points(e.target.value)}
                           className="w-24 bg-transparent outline-none text-right font-semibold text-lg"
                        />
                     </div>

                  </div>

                  <div className="flex gap-3 mt-8">
                    <button onClick={() => setStep(0)} className="pm-button-secondary px-6">Back</button>
                    <button 
                      onClick={() => setStep(2)}
                      className="pm-button flex-1 py-5 text-lg"
                    >
                      {card1Points || card2Points ? 'Save & Continue' : 'Skip for now'} <ArrowRight className="w-5 h-5 ml-2 inline" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Value Aha Moment */}
              {step === 2 && (
                <motion.div 
                  key="step2"
                  variants={slideVariants}
                  initial="initial" animate="animate" exit="exit"
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="p-10 sm:p-12 flex-1 flex flex-col items-center justify-center text-center bg-gradient-to-b from-pm-surface to-pm-surface-soft"
                >
                  <div className="w-20 h-20 rounded-3xl bg-pm-accent/10 border border-pm-accent/20 flex items-center justify-center text-pm-accent mb-8 shadow-xl shadow-pm-accent/10">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  
                  <h2 className="pm-display text-4xl sm:text-5xl mb-4">You&apos;re all set.</h2>
                  <p className="text-pm-ink-500 text-lg max-w-md mx-auto mb-10 leading-relaxed">
                    We&apos;ll automatically scan Live availability and match flights from {homeAirport || 'your airport'} against your new balances.
                  </p>

                  <button 
                    onClick={handleComplete}
                    disabled={loading}
                    className="pm-button w-full max-w-sm py-5 text-lg shadow-xl hover:-translate-y-1 transition-all"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Enter PointsMax →'}
                  </button>
                </motion.div>
              )}

           </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
