# Gemini Task Assignment: PointsMax Frontend Polish

**Branch:** `git checkout -b gemini/frontend-polish`
**Base:** `main`
**When done:** Open a PR against `main` titled "Frontend polish: shadcn theming, skeletons, logo"

Run `npm run build` after each task. If the build breaks, fix it before moving on.

---

## Task G1 — Fix shadcn/Radix Component Theming in Dark Mode

**File:** `src/app/globals.css`

**The problem:** Every interactive Radix UI component (Select dropdowns, Calendars, Dialogs, Popovers, Toasts, Command palette) uses shadcn's HSL token system (`--background`, `--card`, `--accent`, `--border`, `--ring`, etc.). The current `:root` and `.dark` blocks use the **default shadcn values** — generic grays that clash with PointsMax's green-tinted dark palette. The result: dropdowns look dark charcoal-gray while the rest of the app is green-tinted dark.

**What to do:**

Replace the entire `@layer base { :root { ... } .dark { ... } }` block at the bottom of `globals.css` with these values, which are the PointsMax palette expressed as HSL:

```css
@layer base {
  :root {
    /* Light mode — maps to PointsMax light palette */
    --background:         120 13% 96%;    /* #f3f8f3 */
    --foreground:         162 34% 9%;     /* #0e1c16 */
    --card:               0 0% 100%;      /* #ffffff */
    --card-foreground:    162 34% 9%;
    --popover:            0 0% 100%;
    --popover-foreground: 162 34% 9%;
    --primary:            174 80% 26%;    /* #0f766e — teal */
    --primary-foreground: 0 0% 100%;
    --secondary:          142 28% 94%;    /* #edf6f0 */
    --secondary-foreground: 162 34% 9%;
    --muted:              142 28% 94%;
    --muted-foreground:   162 13% 40%;   /* #59766a */
    --accent:             174 80% 26%;   /* #0f766e — use pm-accent, not gray */
    --accent-foreground:  0 0% 100%;
    --destructive:        4 72% 40%;     /* #b42318 */
    --destructive-foreground: 0 0% 100%;
    --border:             141 23% 85%;   /* #d5e5d9 */
    --input:              141 23% 85%;
    --ring:               174 80% 26%;   /* teal focus ring */
    --chart-1: 174 62% 47%;
    --chart-2: 142 69% 27%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 50%;
    --chart-5: 27 87% 55%;
    --radius: 0.5rem;
  }

  .dark {
    /* Dark mode — maps to PointsMax dark palette */
    --background:         162 22% 6%;    /* #0a0f0e */
    --foreground:         155 28% 94%;   /* #ecf5f0 */
    --card:               162 22% 9%;    /* #111b18 */
    --card-foreground:    155 28% 94%;
    --popover:            162 22% 9%;
    --popover-foreground: 155 28% 94%;
    --primary:            174 62% 50%;   /* #2dd4bf — bright teal */
    --primary-foreground: 162 22% 6%;    /* dark bg for contrast */
    --secondary:          162 18% 12%;   /* #1a2622 */
    --secondary-foreground: 155 28% 94%;
    --muted:              162 18% 12%;
    --muted-foreground:   162 13% 47%;   /* #6b9080 */
    --accent:             174 62% 50%;   /* #2dd4bf — teal, not gray */
    --accent-foreground:  162 22% 6%;
    --destructive:        0 72% 70%;     /* #f87171 */
    --destructive-foreground: 162 22% 6%;
    --border:             162 14% 16%;   /* approximates rgba(255,255,255,0.08) on dark bg */
    --input:              162 14% 16%;
    --ring:               174 62% 50%;   /* teal focus ring */
    --chart-1: 174 62% 47%;
    --chart-2: 142 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}
```

**Why this matters:** After this change, Select dropdowns, Calendars, Dialogs, Command palette, and Toasts will all use the PointsMax green-tinted dark surface colors and teal accent/ring instead of clashing grays.

**Acceptance criteria:**
- [ ] `npm run build` passes
- [ ] Navigate to `/us/calculator`. Open any Select dropdown — background should be `#111b18` (dark green surface), not near-black gray
- [ ] Any focused input should have a teal `--ring` focus outline
- [ ] Toggle to light mode — dropdowns should switch to white/light-green surfaces
- [ ] Destructive actions (Sign out button) should have a red tint, not pink

**Commit message:** `fix: align shadcn HSL tokens with PointsMax dark/light palette`

---

## Task G2 — Create Missing Loading Skeletons for Inspire and Trip Builder

**The problem:** Two tool pages — Inspire and Trip Builder — have no `loading.tsx` file. Next.js shows a blank screen (or abrupt content pop-in) while these pages load data. They need skeleton screens that match their actual layout.

**Files to create:**
- `src/app/[region]/inspire/loading.tsx`
- `src/app/[region]/trip-builder/loading.tsx`

**Also improve:** `src/app/[region]/earning-calculator/loading.tsx` — the current skeleton is too generic (just stacked full-width bars). Replace it with a skeleton that reflects the actual two-column layout of the page.

### Inspire page skeleton

The Inspire page has:
- A full-width hero/banner area at the top with heading + subheading
- Below: a wallet balance summary bar (horizontal, shows total points)
- Below: a filter row with destination type chips
- Below: a grid of destination cards (3 columns on desktop, 2 on tablet, 1 on mobile)

Create a skeleton that mirrors this structure:

```tsx
// src/app/[region]/inspire/loading.tsx
export default function InspireLoading() {
  return (
    <div className="animate-pulse">
      {/* Hero area */}
      <div className="bg-pm-surface border-b border-pm-border py-10">
        <div className="pm-shell space-y-3">
          <div className="h-9 w-72 rounded-xl bg-pm-surface-soft" />
          <div className="h-5 w-96 rounded-lg bg-pm-surface-soft" />
        </div>
      </div>

      <div className="pm-shell py-8 space-y-6">
        {/* Wallet summary bar */}
        <div className="flex items-center gap-4">
          <div className="h-5 w-32 rounded bg-pm-surface-soft" />
          <div className="flex gap-2">
            {[80, 96, 72, 88].map((w) => (
              <div key={w} className={`h-8 w-${w / 4} rounded-full bg-pm-surface-soft`} />
            ))}
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2">
          {[96, 80, 112, 72, 88].map((w) => (
            <div key={w} className="h-8 rounded-full bg-pm-surface-soft" style={{ width: w }} />
          ))}
        </div>

        {/* Destination card grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="pm-card overflow-hidden">
              {/* Image placeholder */}
              <div className="h-44 bg-pm-surface-soft" />
              {/* Content */}
              <div className="p-4 space-y-2">
                <div className="h-5 w-3/4 rounded bg-pm-surface-soft" />
                <div className="h-4 w-1/2 rounded bg-pm-surface-soft" />
                <div className="flex items-center justify-between pt-1">
                  <div className="h-6 w-20 rounded-full bg-pm-surface-soft" />
                  <div className="h-5 w-16 rounded bg-pm-surface-soft" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### Trip Builder page skeleton

The Trip Builder page has:
- A page heading + description
- A step-based wizard UI: Step 1 (from/to airports + dates), Step 2 (cabin + travelers), Step 3 (review)
- On the right: a running trip cost summary panel

Create a skeleton:

```tsx
// src/app/[region]/trip-builder/loading.tsx
export default function TripBuilderLoading() {
  return (
    <div className="pm-shell py-10 animate-pulse">
      {/* Heading */}
      <div className="mb-8 space-y-2">
        <div className="h-8 w-56 rounded-xl bg-pm-border" />
        <div className="h-5 w-80 rounded-lg bg-pm-surface-soft" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Wizard panel */}
        <div className="pm-card p-6 space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-3">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-pm-surface-soft" />
                {s < 3 && <div className="h-px w-10 bg-pm-border" />}
              </div>
            ))}
          </div>

          {/* Route inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="h-4 w-16 rounded bg-pm-surface-soft" />
              <div className="h-12 rounded-xl bg-pm-surface-soft" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-12 rounded bg-pm-surface-soft" />
              <div className="h-12 rounded-xl bg-pm-surface-soft" />
            </div>
          </div>

          {/* Date inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="h-4 w-24 rounded bg-pm-surface-soft" />
              <div className="h-12 rounded-xl bg-pm-surface-soft" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-24 rounded bg-pm-surface-soft" />
              <div className="h-12 rounded-xl bg-pm-surface-soft" />
            </div>
          </div>

          {/* Cabin + traveler row */}
          <div className="grid grid-cols-3 gap-4">
            {[3, 3, 2].map((w, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-4 rounded bg-pm-surface-soft" style={{ width: `${w * 28}px` }} />
                <div className="h-12 rounded-xl bg-pm-surface-soft" />
              </div>
            ))}
          </div>

          {/* CTA button */}
          <div className="h-12 w-40 rounded-full bg-pm-surface-soft" />
        </div>

        {/* Summary panel */}
        <div className="pm-card p-6 space-y-4 h-fit">
          <div className="h-5 w-32 rounded bg-pm-surface-soft" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="h-4 w-24 rounded bg-pm-surface-soft" />
              <div className="h-4 w-16 rounded bg-pm-surface-soft" />
            </div>
          ))}
          <div className="border-t border-pm-border pt-4">
            <div className="flex justify-between">
              <div className="h-5 w-16 rounded bg-pm-surface-soft" />
              <div className="h-5 w-20 rounded bg-pm-surface-soft" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### Improve earning-calculator/loading.tsx

The actual Earning Calculator page is a two-column layout: left has card selection inputs, right shows a table of earn rates per card. Replace the current generic skeleton with this:

```tsx
// src/app/[region]/earning-calculator/loading.tsx
export default function EarningCalculatorLoading() {
  return (
    <div className="pm-shell py-10 animate-pulse space-y-6">
      {/* Heading */}
      <div className="space-y-2">
        <div className="h-8 w-64 rounded-xl bg-pm-border" />
        <div className="h-5 w-80 rounded-lg bg-pm-surface-soft" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Left: inputs */}
        <div className="pm-card p-5 space-y-4 h-fit">
          <div className="h-4 w-20 rounded bg-pm-surface-soft" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-pm-surface-soft" />
              <div className="h-10 rounded-xl bg-pm-surface-soft" />
            </div>
          ))}
          <div className="h-10 rounded-full bg-pm-surface-soft" />
        </div>

        {/* Right: earn rate table */}
        <div className="pm-card overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-4 px-5 py-3 border-b border-pm-border">
            {[180, 100, 80, 80].map((w, i) => (
              <div key={i} className="h-3 rounded bg-pm-surface-soft" style={{ width: w }} />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-pm-border">
              <div className="h-4 w-44 rounded bg-pm-surface-soft" />
              <div className="h-4 w-24 rounded bg-pm-surface-soft" />
              <div className="h-4 w-20 rounded bg-pm-surface-soft" />
              <div className="h-6 w-20 rounded-full bg-pm-surface-soft" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Acceptance criteria:**
- [ ] `npm run build` passes
- [ ] Both new files exist: `inspire/loading.tsx` and `trip-builder/loading.tsx`
- [ ] Loading states use only `pm-*` Tailwind tokens (no hardcoded hex colors)
- [ ] All skeletons use `animate-pulse` class
- [ ] Card grid in inspire skeleton is responsive (1/2/3 column)

**Commit message:** `feat: add loading skeletons for inspire and trip-builder, improve earning-calculator skeleton`

---

## Task G3 — Replace "P" Circle Logo with a Proper SVG Wordmark

**File:** `src/components/NavBar.tsx`

**The problem:** The current logo is a letter "P" in a teal circle next to the text "PointsMax". This looks like a placeholder. A real product has a mark — a small icon that represents the brand.

**What to build:** Replace the `<span>P</span>` circle with an SVG icon. The icon should be a small geometric mark — a stylized "PM" monogram or a compass/arrow icon that suggests navigation and value optimization. It should:
- Be inline SVG (not an image file) — easier to theme
- Use `currentColor` for strokes so it inherits text color, OR use explicit `--pm-accent` values
- Render at 28×28px (same as the current circle)
- Look clean and intentional at small sizes

Here is one option — a clean geometric "PM" mark using two overlapping bars suggesting a path/route:

```tsx
function PMLogoMark({ className }: { className?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Teal filled circle background */}
      <circle cx="14" cy="14" r="14" fill="var(--pm-accent)" />
      {/* White "upward arrow + max" mark — a stylized "↑" suggesting value optimization */}
      {/* Vertical bar */}
      <rect x="11" y="7" width="2.5" height="10" rx="1.25" fill="var(--pm-bg)" />
      {/* Left arm of arrow */}
      <path
        d="M8.5 12 L12.25 7.5 L16 12"
        stroke="var(--pm-bg)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Horizontal baseline — "MAX" suggestion */}
      <rect x="8" y="19" width="12" height="2" rx="1" fill="var(--pm-bg)" />
    </svg>
  )
}
```

Then in the NavBar, replace:
```tsx
{/* BEFORE */}
<span className="inline-flex w-7 h-7 rounded-full bg-pm-accent text-pm-bg items-center justify-center text-sm font-bold">P</span>

{/* AFTER */}
<PMLogoMark />
```

**You are free to design a different mark** — you don't have to use the above SVG exactly. The requirements are:
1. Inline SVG, 28×28px
2. Uses `var(--pm-accent)` for the background/fill (so it adapts to both dark and light themes)
3. Uses `var(--pm-bg)` for the icon strokes/shapes on top (white in dark mode, dark in light mode)
4. Looks intentional — not random squiggles, something clean and geometric
5. Works at 28px (don't use intricate detail that disappears at small size)

**Acceptance criteria:**
- [ ] `npm run build` passes
- [ ] Logo appears in NavBar on every page
- [ ] Icon looks clean and recognizable at 28px
- [ ] Icon uses CSS variables so it works in both dark and light modes
- [ ] The `PMLogoMark` function is defined in the same file (NavBar.tsx) above the component, not in a separate file

**Commit message:** `feat: replace letter P placeholder with SVG logomark in NavBar`

---

## Evaluation Rubric

We will judge Gemini's work on:

| Criterion | What we're looking for |
|---|---|
| **Correctness** | Does the build pass? Do the changes actually fix the stated problem? |
| **Visual quality** | Do the skeletons look like the real pages? Does the logo look intentional? Do the shadcn components match the design system? |
| **Code quality** | Clean JSX, no hardcoded colors, consistent with existing patterns |
| **Judgment** | Did Gemini follow instructions exactly, or did it over-engineer / cut corners? |
| **Design sense** | Does the logo look like real design work or a placeholder? |

The shadcn task (G1) is the most mechanical — correct or not correct.
The skeleton task (G2) tests layout understanding and attention to detail.
The logo task (G3) is the most subjective — it tests actual design judgment.

---

**Document End**
