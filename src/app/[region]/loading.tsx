export default function LandingLoading() {
  return (
    <div className="min-h-screen bg-pm-bg animate-pulse">

      {/* NavBar */}
      <div className="fixed inset-x-0 top-0 z-50 h-16 border-b border-pm-border bg-pm-surface/80">
        <div className="pm-shell flex h-full items-center justify-between">
          <div className="h-5 w-28 rounded-full bg-pm-surface-soft" />
          <div className="hidden md:flex items-center gap-6">
            {[80, 96, 64, 72].map((w) => (
              <div key={w} className="h-3.5 rounded-full bg-pm-surface-soft" style={{ width: w }} />
            ))}
          </div>
          <div className="h-9 w-24 rounded-full bg-pm-surface-soft" />
        </div>
      </div>

      <main className="pt-16">

        {/* Hero */}
        <section className="relative min-h-[85vh] flex items-center">
          <div className="pm-shell w-full py-20">
            <div className="max-w-3xl space-y-5">
              <div className="h-16 w-3/4 rounded-2xl bg-pm-surface-soft" />
              <div className="h-16 w-1/2 rounded-2xl bg-pm-surface-soft" />
              <div className="h-16 w-1/3 rounded-2xl bg-pm-surface-soft" />
              <div className="pt-4 space-y-2">
                <div className="h-5 w-full max-w-lg rounded-full bg-pm-surface-soft" />
                <div className="h-5 w-2/3 max-w-sm rounded-full bg-pm-surface-soft" />
              </div>
              <div className="pt-4 flex gap-4">
                <div className="h-12 w-52 rounded-full bg-pm-surface-soft" />
                <div className="h-12 w-40 rounded-full bg-pm-border" />
              </div>
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <section className="border-y border-pm-border bg-pm-surface/30">
          <div className="pm-shell py-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`flex flex-col items-center gap-3 ${i < 2 ? 'md:border-r md:border-pm-border' : ''}`}
                >
                  <div className="h-12 w-36 rounded-xl bg-pm-surface-soft" />
                  <div className="h-3.5 w-24 rounded-full bg-pm-border" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Process steps */}
        <section className="py-24 space-y-24">
          {[0, 1, 2].map((i) => (
            <div key={i} className="pm-shell">
              <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                <div className={`space-y-4 ${i % 2 === 1 ? 'lg:order-2' : 'lg:order-1'}`}>
                  <div className="h-3 w-16 rounded-full bg-pm-accent/30" />
                  <div className="h-10 w-4/5 rounded-xl bg-pm-surface-soft" />
                  <div className="h-10 w-3/5 rounded-xl bg-pm-surface-soft" />
                  <div className="space-y-2 pt-2">
                    <div className="h-4 w-full rounded-full bg-pm-border" />
                    <div className="h-4 w-5/6 rounded-full bg-pm-border" />
                    <div className="h-4 w-4/6 rounded-full bg-pm-border" />
                  </div>
                </div>
                <div className={`rounded-2xl border border-pm-border bg-pm-surface p-6 space-y-3 ${i % 2 === 1 ? 'lg:order-1' : 'lg:order-2'}`}>
                  <div className="h-4 w-24 rounded-full bg-pm-surface-soft" />
                  <div className="h-12 rounded-xl bg-pm-surface-soft" />
                  <div className="h-12 rounded-xl bg-pm-surface-soft" />
                  <div className="h-12 rounded-xl bg-pm-surface-soft" />
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Quick value calculator */}
        <section className="py-24">
          <div className="pm-shell max-w-3xl">
            <div className="text-center mb-12 space-y-3">
              <div className="mx-auto h-3 w-28 rounded-full bg-pm-border" />
              <div className="mx-auto h-9 w-72 rounded-xl bg-pm-surface-soft" />
            </div>
            <div className="rounded-3xl border border-pm-border bg-pm-surface/70 p-8 md:p-10 space-y-6">
              <div className="space-y-2">
                <div className="h-3 w-12 rounded-full bg-pm-border" />
                <div className="h-11 rounded-xl bg-pm-surface-soft" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-24 rounded-full bg-pm-border" />
                <div className="h-11 rounded-xl bg-pm-surface-soft" />
              </div>
              <div className="rounded-xl bg-pm-surface-soft p-5 space-y-2">
                <div className="h-3 w-28 rounded-full bg-pm-border" />
                <div className="h-9 w-32 rounded-lg bg-pm-border" />
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 md:py-32">
          <div className="pm-shell flex flex-col items-center gap-5">
            <div className="h-12 w-96 max-w-full rounded-2xl bg-pm-surface-soft" />
            <div className="h-12 w-72 max-w-full rounded-2xl bg-pm-surface-soft" />
            <div className="space-y-2 pt-2 text-center">
              <div className="mx-auto h-5 w-80 rounded-full bg-pm-border" />
              <div className="mx-auto h-5 w-56 rounded-full bg-pm-border" />
            </div>
            <div className="mt-4 h-14 w-56 rounded-full bg-pm-surface-soft" />
          </div>
        </section>

      </main>
    </div>
  )
}
