# PointsMax Visual Redesign v2 — Refined Plan

**Date:** February 26, 2026
**Status:** Approved for implementation
**Based on:** Zoox plan v1 + Linear, Vercel, Raycast, Stripe, Mercury analysis

---

## Design Philosophy Change

**v1 (Zoox-inspired):** Brand showcase site — cinematic, photography-heavy, hidden navigation
**v2 (Refined):** Dark-first product tool — functional, trustworthy, premium but usable

We're building a **tool people use daily** (like Linear/Raycast), not a **brand site people visit once** (like Zoox). Every design decision must serve usability first, aesthetics second.

---

## What We're Keeping from Zoox Plan

- Dark-first color system (but with blue-tinted blacks, not neutral blacks)
- Glass-morphism for the calculator widget
- Scroll-triggered fade-up animations (subtle, not cinematic)
- Glow buttons with hover effects
- Increased section spacing for premium feel

## What We're Dropping from Zoox Plan

| Zoox Element | Why We're Dropping It | Replacement |
|---|---|---|
| Hamburger-only navigation | PointsMax is a tool — users need quick access to Calculator, Award Search, etc. | Visible horizontal nav (Linear/Vercel style) with hamburger on mobile only |
| Scrolling text marquee | Reads as trendy/startup-y — PointsMax needs trust for financial decisions | Animated counter showing "X points optimized" (Stripe data-as-design pattern) |
| Full-bleed hero photography | Zero photography assets; stock travel photos look generic | Abstract gradient meshes (Stripe) or subtle particle effects on dark |
| Full-screen menu overlay | Over-engineered for a tool with 5-7 nav items | Standard mobile drawer |

---

## Final Design System

### Color Palette

```css
:root {
  /* === Dark mode (PRIMARY — default) === */

  /* Backgrounds — green-tinted dark (keeps PointsMax brand identity) */
  --pm-bg:             #0a0f0e;    /* page background — deep charcoal with green undertone */
  --pm-surface:        #111b18;    /* card/panel backgrounds */
  --pm-surface-soft:   #1a2622;    /* hover states, secondary surfaces */
  --pm-surface-raised: #213330;    /* elevated panels, dropdowns */

  /* Borders — near-invisible, Linear approach */
  --pm-border:         rgba(255, 255, 255, 0.08);
  --pm-border-strong:  rgba(255, 255, 255, 0.15);

  /* Text — 3-level hierarchy */
  --pm-ink-900:        #ecf5f0;    /* primary text, headings */
  --pm-ink-700:        #b8d4c8;    /* secondary text, descriptions */
  --pm-ink-500:        #6b9080;    /* muted text, captions */

  /* Accent — keep teal (PointsMax identity), brighten for dark bg */
  --pm-accent:         #2dd4bf;    /* primary actions, links */
  --pm-accent-strong:  #14b8a6;    /* hover/active state */
  --pm-accent-soft:    rgba(45, 212, 191, 0.12);  /* tinted backgrounds */
  --pm-accent-glow:    rgba(45, 212, 191, 0.25);  /* button glow shadow */

  /* Semantic */
  --pm-success:        #34d399;
  --pm-success-soft:   rgba(52, 211, 153, 0.12);
  --pm-warning:        #fbbf24;
  --pm-warning-soft:   rgba(251, 191, 36, 0.12);
  --pm-danger:         #f87171;
  --pm-danger-soft:    rgba(248, 113, 113, 0.12);

  /* Elevation */
  --pm-shadow-xs:      0 2px 8px rgba(0, 0, 0, 0.3);
  --pm-shadow-soft:    0 12px 34px rgba(0, 0, 0, 0.4);
  --pm-shadow-glow:    0 0 40px var(--pm-accent-glow);
  --pm-radius-xl:      18px;
  --pm-radius-lg:      14px;
}

/* === Light mode (secondary — user opt-in) === */
.light {
  --pm-bg:             #f3f8f3;
  --pm-surface:        #ffffff;
  --pm-surface-soft:   #edf6f0;
  --pm-surface-raised: #ffffff;
  --pm-border:         #d5e5d9;
  --pm-border-strong:  #b7cfc0;
  --pm-ink-900:        #0e1c16;
  --pm-ink-700:        #264338;
  --pm-ink-500:        #59766a;
  --pm-accent:         #0f766e;
  --pm-accent-strong:  #0b5e57;
  --pm-accent-soft:    #d6f2ee;
  --pm-accent-glow:    rgba(15, 118, 110, 0.2);
  --pm-success:        #157347;
  --pm-success-soft:   #ecf9f1;
  --pm-warning:        #b45309;
  --pm-warning-soft:   #fff8eb;
  --pm-danger:         #b42318;
  --pm-danger-soft:    #fff2f2;
  --pm-shadow-xs:      0 2px 8px rgba(10, 40, 25, 0.06);
  --pm-shadow-soft:    0 12px 34px rgba(10, 40, 25, 0.08);
  --pm-shadow-glow:    0 0 40px var(--pm-accent-glow);
}
```

### Typography

- **Display font:** Geist Sans (keep existing — no need for a serif; travel tool ≠ editorial)
- **Hero headlines:** 64–80px, font-weight 700, letter-spacing -0.03em
- **Section headlines:** 36–48px, font-weight 600
- **Body:** 16–18px, line-height 1.6
- **Captions/labels:** 12–14px, uppercase, letter-spacing 0.05em (existing `.pm-label`)
- **Monospace (data):** Geist Mono for point values, CPP numbers

### Navigation (Linear/Vercel hybrid)

```
┌──────────────────────────────────────────────────────────────────┐
│  [PM Logo]   Calculator  Award Search  Inspire  Trip Builder    │
│                                              [Sign In] [Start →]│
└──────────────────────────────────────────────────────────────────┘
```

- **Desktop (≥1024px):** Horizontal sticky header, visible links, CTA button right-aligned
- **Tablet (768–1023px):** Logo + hamburger + CTA
- **Mobile (<768px):** Logo + hamburger, CTA in menu
- **Backdrop blur:** `backdrop-filter: blur(12px)` on scroll
- **Border:** `1px solid var(--pm-border)` bottom edge
- **Height:** 64px, stored as `--navbar-height` CSS variable (Mercury pattern)

### Cards (Raycast-inspired shadow stack)

```css
.pm-card {
  background: var(--pm-surface);
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-xl);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),  /* subtle top edge */
    var(--pm-shadow-xs);
  transition: all 200ms ease-out;
}

.pm-card:hover {
  border-color: var(--pm-border-strong);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    var(--pm-shadow-soft),
    0 0 48px var(--pm-accent-glow);           /* ambient accent glow */
}
```

### Buttons

```css
/* Primary — pill shape, accent glow */
.pm-button {
  background: var(--pm-accent);
  color: var(--pm-bg);
  border-radius: 9999px;
  padding: 12px 28px;
  font-weight: 600;
  box-shadow: 0 4px 14px var(--pm-accent-glow);
  transition: all 200ms ease-out;
}
.pm-button:hover {
  background: var(--pm-accent-strong);
  box-shadow: var(--pm-shadow-glow);
  transform: translateY(-1px);
}

/* Secondary — ghost/outline */
.pm-button-secondary {
  background: transparent;
  color: var(--pm-ink-900);
  border: 1px solid var(--pm-border-strong);
  border-radius: 9999px;
  padding: 12px 28px;
}
.pm-button-secondary:hover {
  background: var(--pm-surface-soft);
  border-color: var(--pm-accent);
}
```

### Glass-morphism (Calculator widget)

```css
.pm-glass {
  background: rgba(17, 27, 24, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}
```

### Animations

- **Section reveal:** Fade-up with Intersection Observer, `opacity 0→1`, `translateY(24px→0)`, duration 600ms, ease `[0.16, 1, 0.3, 1]`
- **Page transitions:** Existing Framer Motion `PageTransition` component — keep as-is
- **Hover transitions:** 200ms ease-out for color/border/shadow changes
- **Reduced motion:** Always respect `prefers-reduced-motion: reduce`
- **NO marquee/scrolling text**
- **NO parallax**
- **NO Lenis smooth scroll** (native smooth scroll is sufficient)

### Trust Signals (Stripe pattern → PointsMax)

Replace the scrolling marquee with data-driven trust elements:

```
┌──────────────────────────────────────────────────────────────┐
│  2.3M+              340+                 4.7×               │
│  Points Optimized   Transfer Partners    Avg Value Lift     │
└──────────────────────────────────────────────────────────────┘
```

Large display numbers (48px+, Geist Mono) with small supporting captions below.

---

## Implementation Phases

### Phase 0: Hardcoded Color Cleanup (PREREQUISITE — must happen first)

Replace all ~20 hardcoded hex color patterns across ~15 files with `pm-*` Tailwind tokens. Without this, the dark theme switch will leave hundreds of elements stuck in light-mode colors.

**Files to fix (by severity):**
1. `award-search/page.tsx` — heaviest
2. `trip-builder/page.tsx` — very heavy
3. `card-recommender/page.tsx` — heavy
4. `inspire/page.tsx` — heavy
5. `earning-calculator/page.tsx` — moderate
6. `calculator/components/award-results.tsx` — heavy
7. `calculator/components/ai-chat.tsx` — moderate
8. `calculator/page.tsx` — moderate
9. `profile/page.tsx` — heavy
10. All `loading.tsx` skeleton files
11. `globals.css` component classes (`.pm-card-soft`, `.pm-button`, `.pm-input`, `.pm-button-secondary`)
12. `NavBar.tsx` — minor (`hover:bg-red-50`)
13. Legal/SEO pages — minor

**Hex → Token mapping:**

| Hardcoded | Replace with |
|---|---|
| `#0f766e`, `#0b5e57`, `#0d5f58`, `#0f5f57` | `pm-accent` / `pm-accent-strong` |
| `#ecf9f7`, `#d6f2ee`, `#ecf9f1`, `#def4ef` | `bg-pm-accent-soft` |
| `#b8e3da`, `#8ecfc0`, `#9ad6c9`, `#8ed3c8` | `border-pm-accent-soft` (may need new `--pm-accent-border` token) |
| `#157347`, `#2bb673` | `pm-success` |
| `#b42318`, `#8a1c16`, `#7a1e16` | `pm-danger` |
| `#fff2f2`, `#fff4f3`, `#f9d4d4`, `#f5c8c5` | `bg-pm-danger-soft` / `border-pm-danger-soft` |
| `#b45309`, `#8a5b12` | `pm-warning` |
| `#fff8eb`, `#f2d8ad` | `bg-pm-warning-soft` / `border-pm-warning-soft` |
| `#0e1c16`, `#173f34`, `#163d33`, `#244437` | `pm-ink-900` |
| `#264338`, `#365649`, `#355246`, `#2c4d41` | `pm-ink-700` |
| `#59766a`, `#5f7c70`, `#6a8579`, `#7f978c`, etc. | `pm-ink-500` |
| `#d5e5d9`, `#dbe9e2`, `#dce9e2`, `#d7e8dd` | `pm-border` |
| `#f3f8f3`, `#f8fcf9`, `#f4faf7`, `#f7fbf8` | `pm-surface-soft` |
| `bg-white` | `bg-pm-surface` |
| `bg-red-50` | `bg-pm-danger-soft` |
| `rgba(236,246,240,0.52)` | `bg-pm-surface-soft/50` |

### Phase 1: Design Token Foundation

1. Update `globals.css` with new dark-first color system (above)
2. Add missing tokens: `--pm-accent-border`, `--pm-danger-soft`, `--pm-warning-soft`, `--pm-success-soft`, `--pm-surface-raised`, `--pm-border-strong`, `--pm-accent-glow`, `--pm-shadow-glow`
3. Update `tailwind.config.ts` to wire new tokens
4. Switch `defaultTheme` from `"system"` to `"dark"` in ThemeProvider
5. Change class-based dark mode from `.dark` to `.light` (dark is now default — light is the override class)
6. Add `--navbar-height: 64px` CSS variable
7. Update `.pm-card`, `.pm-button`, `.pm-input`, `.pm-card-soft`, `.pm-button-secondary` component classes

### Phase 2: Navigation Redesign

1. Redesign NavBar as horizontal sticky header (keep visible links on desktop)
2. Backdrop blur on scroll
3. Pill-shaped CTA button in header
4. Mobile hamburger with slide-down drawer (not full-screen overlay)
5. Dark mode toggle placement: in nav, smaller, icon-only

### Phase 3: Landing Page Redesign

1. Hero: large headline (64-80px), subtext, CTA button, NO photography — use subtle gradient mesh bg
2. Trust strip: large stat numbers (Stripe pattern) instead of proof pills
3. Feature sections: alternating text/image layout with product UI screenshots
4. Calculator preview: glass-morphism card
5. Final CTA section
6. Scroll-triggered fade-up animations via Intersection Observer

### Phase 4: Component Polish & Animations

1. GlowButton component with arrow icon
2. GlassCard component for calculator
3. SectionReveal wrapper (Intersection Observer + Framer Motion)
4. Updated form inputs for dark theme
5. Updated pills/badges for dark theme
6. `prefers-reduced-motion` support

### Phase 5: Page-by-Page Dark Theme Application

Apply the new design system to each tool page:
1. Calculator page
2. Award Search page
3. Inspire page
4. Trip Builder page
5. Earning Calculator page
6. Card Recommender page
7. Profile page
8. How It Works page
9. Pricing page
10. Legal pages (terms, privacy)

---

## What NOT to Change

- **Functionality:** Zero changes to business logic, API calls, data flow
- **URL structure:** Keep `/[region]/` routing
- **Auth flow:** Keep Supabase auth as-is
- **Admin pages:** Leave untouched (internal only)
- **Favicon/OG images:** Keep hardcoded (they render via ImageResponse, not CSS)
- **Database:** No schema changes

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Dark mode breaks existing users | Keep light mode toggle, default dark for new users only initially |
| Hardcoded color cleanup introduces bugs | Do one file at a time, visual diff each page |
| Calculator (2033 lines) breaks | Test extensively, change only color classes not logic |
| Performance regression from animations | Use only `transform` + `opacity`, no layout triggers |

---

**Document End**
