# Kimi Task Assignment: PointsMax Visual Redesign

**Sprint:** Visual Redesign
**Reference:** `VISUAL_REDESIGN_PLAN_V2.md`
**Priority:** Execute tasks in order — each phase depends on the previous one.

---

## PHASE 0: Hardcoded Color Cleanup

> **Goal:** Replace every hardcoded hex color with `pm-*` Tailwind tokens so the dark theme switch works everywhere. This is the foundation — nothing else works without it.

---

### Task 0.1 — Add Missing Design Tokens to globals.css and tailwind.config.ts

**Status:** ⬜ Not Started
**Priority:** P0 — Blocking everything else
**Estimated scope:** 2 files

**What to do:**

1. Open `src/app/globals.css`. In the `:root` block, add these new CSS variables (keep all existing variables — just ADD these):

```css
/* New tokens needed for the redesign */
--pm-surface-raised: #ffffff;     /* elevated panels, dropdowns */
--pm-border-strong:  #b7cfc0;     /* stronger borders for emphasis */
--pm-accent-border:  #b8e3da;     /* accent-colored borders (for badges, highlights) */
--pm-accent-glow:    rgba(15, 118, 110, 0.2);  /* button glow shadow */
--pm-success-soft:   #ecf9f1;     /* success tinted background */
--pm-warning-soft:   #fff8eb;     /* warning tinted background */
--pm-danger-soft:    #fff2f2;     /* danger tinted background */
--pm-danger-border:  #f9d4d4;     /* danger tinted border */
--pm-warning-border: #f2d8ad;     /* warning tinted border */
--pm-success-border: #c7e7d4;     /* success tinted border */
--pm-shadow-glow:    0 0 40px var(--pm-accent-glow);
```

2. In the `.dark` block, add the dark-mode equivalents:

```css
--pm-surface-raised: #213330;
--pm-border-strong:  rgba(255, 255, 255, 0.15);
--pm-accent-border:  rgba(45, 212, 191, 0.25);
--pm-accent-glow:    rgba(45, 212, 191, 0.25);
--pm-success-soft:   rgba(52, 211, 153, 0.12);
--pm-warning-soft:   rgba(251, 191, 36, 0.12);
--pm-danger-soft:    rgba(248, 113, 113, 0.12);
--pm-danger-border:  rgba(248, 113, 113, 0.2);
--pm-warning-border: rgba(251, 191, 36, 0.2);
--pm-success-border: rgba(52, 211, 153, 0.2);
--pm-shadow-glow:    0 0 40px var(--pm-accent-glow);
```

3. Open `tailwind.config.ts`. In `theme.extend.colors`, add the new token mappings:

```typescript
'pm-surface-raised': 'var(--pm-surface-raised)',
'pm-border-strong': 'var(--pm-border-strong)',
'pm-accent-border': 'var(--pm-accent-border)',
'pm-accent-glow': 'var(--pm-accent-glow)',
'pm-success-soft': 'var(--pm-success-soft)',
'pm-warning-soft': 'var(--pm-warning-soft)',
'pm-danger-soft': 'var(--pm-danger-soft)',
'pm-danger-border': 'var(--pm-danger-border)',
'pm-warning-border': 'var(--pm-warning-border)',
'pm-success-border': 'var(--pm-success-border)',
```

In `theme.extend.boxShadow`, add:
```typescript
'glow': 'var(--pm-shadow-glow)',
```

**Acceptance criteria:**
- [ ] All new CSS variables exist in both `:root` and `.dark` blocks
- [ ] All new tokens are wired in `tailwind.config.ts`
- [ ] `npm run build` passes with no errors
- [ ] Existing pages look identical (no visual regression)

**Commit message:** `feat: add missing design tokens for visual redesign (surface-raised, accent-border, semantic soft/border variants)`

---

### Task 0.2 — Fix Hardcoded Colors in globals.css Component Classes

**Status:** ⬜ Not Started
**Priority:** P0
**Estimated scope:** 1 file (`src/app/globals.css`)

**What to do:**

In `globals.css`, find the `@layer components` section. Fix these classes:

1. `.pm-card-soft` — Replace the hardcoded gradient:
   - **Find:** `background: linear-gradient(to bottom right, #ffffff, #f8fcf9);`
   - **Replace with:** `background: linear-gradient(to bottom right, var(--pm-surface), var(--pm-surface-soft));`

2. `.pm-button` — Replace the hardcoded box-shadow:
   - **Find:** `box-shadow: 0 4px 14px rgba(15, 118, 110, 0.28);`
   - **Replace with:** `box-shadow: 0 4px 14px var(--pm-accent-glow);`

3. `.pm-button-secondary` — Replace hardcoded white background:
   - **Find:** `background: white;`
   - **Replace with:** `background: var(--pm-surface);`

4. `.pm-input` — Replace hardcoded white background:
   - **Find:** `background: white;`
   - **Replace with:** `background: var(--pm-surface);`

**Acceptance criteria:**
- [ ] No remaining hardcoded hex colors or `white` in `@layer components`
- [ ] Light mode looks identical to before
- [ ] Dark mode toggle now correctly themes buttons, cards, and inputs

---

### Task 0.3 — Fix Hardcoded Colors in award-search/page.tsx

**Status:** ⬜ Not Started
**Priority:** P0
**Estimated scope:** 1 file

**File:** `src/app/[region]/award-search/page.tsx`

**Replacement rules (apply throughout the entire file):**

| Find (hardcoded) | Replace with (Tailwind token) |
|---|---|
| `bg-[#e9f8f3]` | `bg-pm-accent-soft` |
| `border-[#9ad6c9]` | `border-pm-accent-border` |
| `bg-[#f2f7f3]` | `bg-pm-surface-soft` |
| `border-[#dce9e1]` | `border-pm-border` |
| `bg-white` (on cards/containers) | `bg-pm-surface` |
| `border-[#d5e5d9]` | `border-pm-border` |
| `text-[#173f34]` | `text-pm-ink-900` |
| `text-[#5f7c70]` | `text-pm-ink-500` |
| `text-[#157347]` | `text-pm-success` |
| `text-[#244437]` | `text-pm-ink-900` |
| `text-[#0f766e]` | `text-pm-accent` |
| `text-[#1f4a3d]` | `text-pm-ink-700` |
| `border-[#d7e8dd]` | `border-pm-border` |
| `bg-[rgba(236,246,240,0.52)]` | `bg-pm-surface-soft/50` |
| `text-[#b42318]` | `text-pm-danger` |
| `bg-[#fff2f2]` | `bg-pm-danger-soft` |
| `border-[#f9d4d4]` | `border-pm-danger-border` |
| `text-[#8a1c16]` | `text-pm-danger` |
| `border-[#bfe4dc]` | `border-pm-accent-border` |
| `bg-[#ecfaf7]` | `bg-pm-accent-soft` |
| `text-[#2c4d41]` | `text-pm-ink-700` |
| `bg-[#f7fbf8]` | `bg-pm-surface-soft` |
| `bg-[#dce9e2]` | `bg-pm-border` |
| `bg-[#e3eee8]` | `bg-pm-surface-soft` |
| `bg-[#0f766e]` | `bg-pm-accent` |
| `bg-[#0d5f58]` | `bg-pm-accent-strong` |
| `bg-[#ecf9f7]` | `bg-pm-accent-soft` |
| `bg-[#f8fcf9]` | `bg-pm-surface-soft` |
| `text-[#365649]` | `text-pm-ink-700` |
| `text-[#0f5f57]` | `text-pm-accent-strong` |

**Acceptance criteria:**
- [ ] Zero hardcoded hex values remain in this file (except inline `style` attributes from DB data like `color_hex`)
- [ ] Page looks identical in light mode
- [ ] Page renders correctly in dark mode

---

### Task 0.4 — Fix Hardcoded Colors in trip-builder/page.tsx

**Status:** ⬜ Not Started
**Priority:** P0
**Estimated scope:** 1 file

**File:** `src/app/[region]/trip-builder/page.tsx`

**Apply the same replacement mapping from Task 0.3.** Additional patterns in this file:

| Find | Replace with |
|---|---|
| `bg-[#ecf9f1]` | `bg-pm-success-soft` |
| `border-[#c7e7d4]` | `border-pm-success-border` |
| `text-[#2a4b3f]` | `text-pm-ink-700` |
| `border-[#dbe9e2]` | `border-pm-border` |
| `text-[#6a8579]` | `text-pm-ink-500` |
| `bg-[#f4faf7]` | `bg-pm-surface-soft` |
| `bg-[#0f766e] text-white` (step numbers) | `bg-pm-accent text-pm-bg` |
| `text-[#0f766e] hover:text-[#0b5e57]` (links) | `text-pm-accent hover:text-pm-accent-strong` |
| `border-[#b8e3da] bg-[#ecf9f7]` (CTA) | `border-pm-accent-border bg-pm-accent-soft` |
| `border-[#0f766e]` (spinner) | `border-pm-accent` |
| `bg-[#8ecfc0]` | `border-pm-accent-border` |
| `text-[#0f5f57]` | `text-pm-accent-strong` |

**Acceptance criteria:** Same as Task 0.3

---

### Task 0.5 — Fix Hardcoded Colors in card-recommender/page.tsx

**Status:** ⬜ Not Started
**Priority:** P0
**Estimated scope:** 1 file

**File:** `src/app/[region]/card-recommender/page.tsx`

**Apply the same replacement mapping.** Additional patterns:

| Find | Replace with |
|---|---|
| `text-[#7f978c]` | `text-pm-ink-500` |
| `hover:border-[#99ccbe]` | `hover:border-pm-accent-border` |
| `bg-[#e7f1ea] text-[#5f7c70] line-through` | `bg-pm-surface-soft text-pm-ink-500 line-through` |
| `border-[#f2c7c5]` | `border-pm-danger-border` |
| `bg-[#fff4f3]` | `bg-pm-danger-soft` |
| `text-[#8d2f2b]` | `text-pm-danger` |
| `text-[#7a1e16]` | `text-pm-danger` |
| `text-[#8ea599]` | `text-pm-ink-500` |
| `ring-[#b8e3da]` | `ring-pm-accent-border` |
| `border-[#b7d5c8]` | `border-pm-border` |
| `focus:ring-[#0f766e]` | `focus:ring-pm-accent` |
| `border-[#dce9e2]` | `border-pm-border` |

**Acceptance criteria:** Same as Task 0.3

---

### Task 0.6 — Fix Hardcoded Colors in inspire/page.tsx

**Status:** ⬜ Not Started
**Priority:** P0
**Estimated scope:** 1 file

**File:** `src/app/[region]/inspire/page.tsx`

**Apply the same replacement mapping.** Additional patterns:

| Find | Replace with |
|---|---|
| `border-[#8ed3c8]` | `border-pm-accent-border` |
| `bg-[#fcfefd]` | `bg-pm-surface` |
| `text-[#8a5b12]` | `text-pm-warning` |
| `bg-[#fff8eb]` | `bg-pm-warning-soft` |
| `border-[#f2d8ad]` | `border-pm-warning-border` |
| `bg-[#def4ef]` | `bg-pm-accent-soft` |
| `hover:bg-[#def4ef]` | `hover:bg-pm-accent-soft` |

**Acceptance criteria:** Same as Task 0.3

---

### Task 0.7 — Fix Hardcoded Colors in earning-calculator/page.tsx

**Status:** ⬜ Not Started
**Priority:** P0
**Estimated scope:** 1 file

**File:** `src/app/[region]/earning-calculator/page.tsx`

**Apply the same replacement mapping.** Additional patterns:

| Find | Replace with |
|---|---|
| `border-[#e2ece6]` | `border-pm-border` |
| `bg-[#edf9f2]` | `bg-pm-success-soft` |
| `hover:bg-[#f6fbf8]` | `hover:bg-pm-surface-soft` |

**Acceptance criteria:** Same as Task 0.3

---

### Task 0.8 — Fix Hardcoded Colors in Calculator Components

**Status:** ⬜ Not Started
**Priority:** P0
**Estimated scope:** 3 files

**Files:**
- `src/app/[region]/calculator/page.tsx`
- `src/app/[region]/calculator/components/award-results.tsx`
- `src/app/[region]/calculator/components/ai-chat.tsx`

**For calculator/page.tsx:**
| Find | Replace with |
|---|---|
| `text-[#173f34]` | `text-pm-ink-900` |
| `hover:bg-[#f2f8f3]` | `hover:bg-pm-surface-soft` |
| `divide-[#e8f2ec]` | `divide-pm-border` |
| `text-[#6a8579]` | `text-pm-ink-500` |
| `bg-red-50` | `bg-pm-danger-soft` |

**For award-results.tsx:** Apply same full mapping as Task 0.3.

**For ai-chat.tsx:**
| Find | Replace with |
|---|---|
| `text-[#5f7c70]` | `text-pm-ink-500` |
| `text-[#163d33]` | `text-pm-ink-900` |
| `text-[#157347]` | `text-pm-success` |
| `text-[#0f766e]` | `text-pm-accent` |
| `border-[#dbeae1]` | `border-pm-border` |
| `bg-red-50` | `bg-pm-danger-soft` |

**Acceptance criteria:**
- [ ] Zero hardcoded hex values in all 3 files
- [ ] Calculator functions correctly (test add balance → get results flow)
- [ ] AI chat renders correctly

---

### Task 0.9 — Fix Hardcoded Colors in profile/page.tsx

**Status:** ⬜ Not Started
**Priority:** P0
**Estimated scope:** 1 file

**File:** `src/app/profile/page.tsx`

**Apply the same replacement mapping.** Additional patterns:

| Find | Replace with |
|---|---|
| `bg-[#0f766e] text-white` (avatar) | `bg-pm-accent text-pm-bg` |
| `bg-[#eef5f0]` | `bg-pm-surface-soft` |
| `text-[#4f6c60]` | `text-pm-ink-500` |
| `border-[#f5c8c5]` | `border-pm-danger-border` |
| `hover:border-[#eba8a4]` | `hover:border-pm-danger` |
| `border-[#f6cdcb]` | `border-pm-danger-border` |
| `text-[#7c3a35]` | `text-pm-danger` |

**Acceptance criteria:** Same as Task 0.3

---

### Task 0.10 — Fix Hardcoded Colors in Remaining Files

**Status:** ⬜ Not Started
**Priority:** P0
**Estimated scope:** ~10 files

**Files (all minor — 1-4 replacements each):**
- `src/components/NavBar.tsx` — replace `hover:bg-red-50` with `hover:bg-pm-danger-soft`
- `src/app/[region]/programs/[slug]/page.tsx` — replace `text-[#0f766e]` → `text-pm-accent`, `text-[#365649]` → `text-pm-ink-700`, `text-[#5f7c70]` → `text-pm-ink-500`
- `src/app/[region]/cards/[slug]/page.tsx` — same as above
- `src/app/[region]/programs/page.tsx` — replace `text-[#5f7c70]` → `text-pm-ink-500`, `text-[#4a6a5d]` → `text-pm-ink-500`
- `src/app/[region]/cards/page.tsx` — same as above
- `src/app/[region]/terms/page.tsx` — replace `text-[#355246]` → `text-pm-ink-700`, `text-[#0f766e]` → `text-pm-accent`
- `src/app/[region]/privacy/page.tsx` — same as terms
- `src/app/[region]/trips/[id]/page.tsx` — `text-[#5f7c70]` → `text-pm-ink-500`, `text-[#173f34]` → `text-pm-ink-900`
- `src/app/page.tsx` — spinner: `border-[#dbe9e2]` → `border-pm-border`, `border-t-[#0f766e]` → `border-t-pm-accent`
- All `loading.tsx` files — replace `bg-[#dce9e2]`, `bg-[#e5efe9]`, `bg-[#edf5f1]`, `bg-[#e1eee7]` → `bg-pm-border` or `bg-pm-surface-soft` as appropriate

**DO NOT TOUCH:**
- `src/app/apple-icon.tsx` — ImageResponse, must stay inline
- `src/app/icon.tsx` — ImageResponse, must stay inline
- `src/app/opengraph-image.tsx` — OG image, must stay inline

**Acceptance criteria:**
- [ ] Running `grep -rn '#[0-9a-fA-F]\{6\}' src/ --include='*.tsx'` returns ONLY the 3 intentionally-hardcoded files (apple-icon, icon, opengraph-image) and any DB-driven inline `style` attributes
- [ ] `npm run build` passes
- [ ] All pages render correctly in both light and dark mode

---

## PHASE 1: Dark-First Design Token Foundation

> **Goal:** Flip the design system to dark-first. Dark mode becomes the default; light mode becomes the opt-in override.

---

### Task 1.1 — Update Color System to Dark-First

**Status:** ⬜ Not Started
**Priority:** P1 — Requires all Phase 0 tasks complete
**Estimated scope:** 2 files

**What to do:**

1. In `globals.css`, restructure the color variables:
   - The `:root` block should contain the **dark mode** values (this is now the default)
   - Replace the `.dark` block with a `.light` block containing the **light mode** values
   - Keep all existing variable names — only change the VALUES in each block

**`:root` (dark — new default):**
```css
--pm-bg:             #0a0f0e;
--pm-surface:        #111b18;
--pm-surface-soft:   #1a2622;
--pm-surface-raised: #213330;
--pm-border:         rgba(255, 255, 255, 0.08);
--pm-border-strong:  rgba(255, 255, 255, 0.15);
--pm-accent-border:  rgba(45, 212, 191, 0.25);
--pm-ink-900:        #ecf5f0;
--pm-ink-700:        #b8d4c8;
--pm-ink-500:        #6b9080;
--pm-accent:         #2dd4bf;
--pm-accent-strong:  #14b8a6;
--pm-accent-soft:    rgba(45, 212, 191, 0.12);
--pm-accent-glow:    rgba(45, 212, 191, 0.25);
--pm-success:        #34d399;
--pm-success-soft:   rgba(52, 211, 153, 0.12);
--pm-success-border: rgba(52, 211, 153, 0.2);
--pm-warning:        #fbbf24;
--pm-warning-soft:   rgba(251, 191, 36, 0.12);
--pm-warning-border: rgba(251, 191, 36, 0.2);
--pm-danger:         #f87171;
--pm-danger-soft:    rgba(248, 113, 113, 0.12);
--pm-danger-border:  rgba(248, 113, 113, 0.2);
--pm-shadow-xs:      0 2px 8px rgba(0, 0, 0, 0.3);
--pm-shadow-soft:    0 12px 34px rgba(0, 0, 0, 0.4);
--pm-shadow-glow:    0 0 40px var(--pm-accent-glow);
--pm-radius-xl:      18px;
--pm-radius-lg:      14px;
```

**`.light` (opt-in light mode):**
```css
--pm-bg:             #f3f8f3;
--pm-surface:        #ffffff;
--pm-surface-soft:   #edf6f0;
--pm-surface-raised: #ffffff;
--pm-border:         #d5e5d9;
--pm-border-strong:  #b7cfc0;
--pm-accent-border:  #b8e3da;
--pm-ink-900:        #0e1c16;
--pm-ink-700:        #264338;
--pm-ink-500:        #59766a;
--pm-accent:         #0f766e;
--pm-accent-strong:  #0b5e57;
--pm-accent-soft:    #d6f2ee;
--pm-accent-glow:    rgba(15, 118, 110, 0.2);
--pm-success:        #157347;
--pm-success-soft:   #ecf9f1;
--pm-success-border: #c7e7d4;
--pm-warning:        #b45309;
--pm-warning-soft:   #fff8eb;
--pm-warning-border: #f2d8ad;
--pm-danger:         #b42318;
--pm-danger-soft:    #fff2f2;
--pm-danger-border:  #f9d4d4;
--pm-shadow-xs:      0 2px 8px rgba(10, 40, 25, 0.06);
--pm-shadow-soft:    0 12px 34px rgba(10, 40, 25, 0.08);
--pm-shadow-glow:    0 0 40px var(--pm-accent-glow);
```

2. Update the body background gradient for dark default (update the `body` rule in globals.css).

3. In `src/app/layout.tsx`, change the ThemeProvider:
   - `defaultTheme="dark"` (was `"system"`)
   - `attribute="class"` stays the same

4. In `tailwind.config.ts`:
   - Change `darkMode: ['class']` to use `'light'` as the class (since dark is now default):
   ```typescript
   darkMode: ['variant', '.light &'],
   ```
   Wait — actually, simpler approach: keep `darkMode: ['class']` but swap which block uses `.dark` vs default. Since we're inverting which is default in CSS, and `next-themes` will add `class="dark"` or `class="light"`, just make sure the CSS matches.

   **Simplest approach:** Keep `darkMode: ['class']` in Tailwind. In `globals.css`, use `:root` for dark values and `.light` for light values. In `ThemeProvider`, set `defaultTheme="dark"`. When the user selects light mode, `next-themes` adds `class="light"` to `<html>`, which triggers the `.light` CSS overrides. This way Tailwind's `dark:` prefix isn't needed (we're using CSS variables, not Tailwind dark: utilities).

**Acceptance criteria:**
- [ ] Site loads in dark mode by default
- [ ] Light mode toggle works and switches to light theme
- [ ] All pages render correctly in both modes
- [ ] `npm run build` passes

**Commit message:** `feat: switch to dark-first design system with light mode as opt-in`

---

### Task 1.2 — Update Component Classes for Dark-First

**Status:** ⬜ Not Started
**Priority:** P1
**Estimated scope:** 1 file (`globals.css`)

**What to do:**

Update the `@layer components` classes for the new design:

```css
.pm-card {
  background: var(--pm-surface);
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-xl);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    var(--pm-shadow-xs);
  transition: border-color 200ms ease-out, box-shadow 200ms ease-out;
}

.pm-card-soft {
  background: linear-gradient(to bottom right, var(--pm-surface), var(--pm-surface-soft));
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-xl);
  box-shadow: var(--pm-shadow-soft);
}

.pm-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--pm-accent);
  color: var(--pm-bg);
  font-weight: 600;
  border-radius: 9999px;
  padding: 0.75rem 1.75rem;
  box-shadow: 0 4px 14px var(--pm-accent-glow);
  transition: all 200ms ease-out;
}
.pm-button:hover {
  background: var(--pm-accent-strong);
  box-shadow: var(--pm-shadow-glow);
  transform: translateY(-1px);
}

.pm-button-secondary {
  background: var(--pm-surface);
  color: var(--pm-ink-900);
  border: 1px solid var(--pm-border-strong);
  border-radius: 9999px;
  padding: 0.75rem 1.75rem;
  transition: all 200ms ease-out;
}
.pm-button-secondary:hover {
  background: var(--pm-surface-soft);
  border-color: var(--pm-accent);
}

.pm-input {
  width: 100%;
  background: var(--pm-surface);
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-lg);
  padding: 0.625rem 0.875rem;
  color: var(--pm-ink-900);
  transition: border-color 200ms ease-out;
}
.pm-input:focus {
  outline: none;
  border-color: var(--pm-accent);
  box-shadow: 0 0 0 3px var(--pm-accent-soft);
}
```

**Acceptance criteria:**
- [ ] Buttons are pill-shaped (border-radius: 9999px)
- [ ] Cards have subtle inset highlight on dark backgrounds
- [ ] Inputs have teal focus ring
- [ ] All component classes use only CSS variables, no hardcoded values

---

### Task 1.3 — Add --navbar-height CSS Variable

**Status:** ⬜ Not Started
**Priority:** P1
**Estimated scope:** 2 files

**What to do:**

1. In `globals.css` `:root`, add: `--navbar-height: 64px;`
2. In `NavBar.tsx`, change the header height to use this variable: `style={{ height: 'var(--navbar-height)' }}` or via Tailwind `h-16` (64px)
3. Ensure all pages with `pt-` padding for the navbar use `pt-[var(--navbar-height)]` or equivalent

**Acceptance criteria:**
- [ ] Navbar is exactly 64px tall
- [ ] Content below navbar is not hidden behind it

---

## PHASE 2: Navigation Redesign

> **Goal:** Modernize the navbar — keep visible links on desktop, add backdrop blur, improve mobile menu.

---

### Task 2.1 — Redesign NavBar Component

**Status:** ⬜ Not Started
**Priority:** P2 — Requires Phase 1 complete
**Estimated scope:** 1 file + potential new component

**File:** `src/components/NavBar.tsx`

**Requirements:**

1. **Desktop (≥1024px):**
   - Sticky header, `z-50`, height `var(--navbar-height)`
   - Left: PointsMax logo (keep existing pill style)
   - Center: horizontal nav links — Calculator, Award Search, Inspire, Trip Builder (from existing Tools dropdown — flatten them into main nav)
   - Right: dark mode toggle (icon-only, smaller) + Sign In / avatar + primary CTA button "Start Free →" (pill-shaped, `pm-button` style but smaller)
   - Background: `bg-pm-bg/80 backdrop-blur-xl` (always, not just on scroll)
   - Bottom border: `border-b border-pm-border`
   - Active link: `text-pm-accent` with subtle `bg-pm-accent-soft` background pill
   - Inactive link: `text-pm-ink-700 hover:text-pm-ink-900`

2. **Tablet/Mobile (<1024px):**
   - Left: logo
   - Right: hamburger icon + dark mode toggle
   - Hamburger opens a slide-down panel (NOT full-screen overlay) with nav links stacked vertically
   - Panel: `bg-pm-surface border-b border-pm-border`
   - Include "Start Free" CTA button in mobile panel

3. **Remove:** The separate "Tools" dropdown — all tools should be in main nav

4. **Keep:** All existing auth logic, account dropdown, region display

**Acceptance criteria:**
- [ ] Desktop shows all nav links horizontally
- [ ] Mobile shows hamburger that opens slide-down panel
- [ ] Backdrop blur visible when scrolling over content
- [ ] Active page link is highlighted
- [ ] Auth flow unchanged
- [ ] Dark mode toggle works

**Commit message:** `feat: redesign NavBar with horizontal layout, backdrop blur, and mobile drawer`

---

## PHASE 3: Landing Page Redesign

> **Goal:** Transform the landing page to a dark, premium feel with large typography, trust signals, and subtle animations.

---

### Task 3.1 — Redesign Hero Section

**Status:** ⬜ Not Started
**Priority:** P3 — Requires Phase 2 complete
**Estimated scope:** 1 file

**File:** `src/app/[region]/page.tsx`

**Requirements for the hero section:**

1. **Layout:** Full-width, min-height `80vh`, centered content, NO two-column grid
2. **Background:** Subtle radial gradient mesh (teal/green glow on dark background) — use CSS gradients, no images needed:
   ```css
   background:
     radial-gradient(ellipse 80% 50% at 50% -20%, rgba(45, 212, 191, 0.15), transparent),
     radial-gradient(ellipse 60% 40% at 80% 80%, rgba(20, 184, 166, 0.08), transparent),
     var(--pm-bg);
   ```
3. **Headline:** 64-80px, font-bold, tight line-height (0.95), content:
   ```
   Stop leaving
   money on the
   table.
   ```
   where "money" is `text-pm-accent`
4. **Subtext:** 20px, `text-pm-ink-700`, max-width 560px
5. **CTA buttons:** `pm-button` "Check your points value →" + `pm-button-secondary` "See how it works"
6. **Trust line below CTA:** "Free · No signup required · Takes 30 seconds" in `text-pm-ink-500`
7. **Fade-in animation:** Framer Motion, `initial={{ opacity: 0, y: 24 }}`, `animate={{ opacity: 1, y: 0 }}`, duration 0.7s

**Drop:** The quick value widget from the hero (move it to its own section below). The hero should be content-focused, not form-focused.

---

### Task 3.2 — Add Trust Stats Strip

**Status:** ⬜ Not Started
**Priority:** P3
**Estimated scope:** 1 file

**File:** `src/app/[region]/page.tsx`

**Replace** the existing proof strip (`pm-pill` chips) with a data-driven stats section:

```
┌────────────────────────────────────────────────────────┐
│    2.3M+              340+              4.7×           │
│  Points Optimized   Transfer Partners  Avg Value Lift  │
└────────────────────────────────────────────────────────┘
```

- Numbers: `text-4xl md:text-5xl font-bold font-mono text-pm-ink-900` (use Geist Mono)
- Labels: `text-sm text-pm-ink-500 uppercase tracking-wider`
- Layout: 3-column grid, centered, `py-20`
- Dividers: vertical `border-r border-pm-border` between items
- Background: subtle `bg-pm-surface/30`

**Note:** Numbers can be hardcoded initially — make them easy to update later.

---

### Task 3.3 — Redesign Feature Sections

**Status:** ⬜ Not Started
**Priority:** P3
**Estimated scope:** 1 file

**File:** `src/app/[region]/page.tsx`

**Replace** the 3-column feature card grid with alternating full-width sections:

Section 1 (text left, visual right):
- Title: "Add your balances" — `text-3xl md:text-4xl font-bold`
- Description: existing copy, `text-pm-ink-700`
- Right side: a styled mock of the wallet/balance UI (can be a `pm-card` with sample data)

Section 2 (visual left, text right):
- Title: "Pick your travel goal"
- Same pattern, reversed layout

Section 3 (text left, visual right):
- Title: "Get the best path"

- Each section: `py-24 md:py-32` vertical padding
- Two-column grid: `grid-cols-1 lg:grid-cols-2 gap-16 items-center`
- Add `SectionReveal` animation wrapper (see Task 4.1)

---

### Task 3.4 — Redesign Calculator Preview Section

**Status:** ⬜ Not Started
**Priority:** P3
**Estimated scope:** 1 file

**File:** `src/app/[region]/page.tsx`

**Wrap** the existing quick value widget (or outcomes section) in a glass-morphism card:

```css
background: rgba(17, 27, 24, 0.7);
backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 24px;
box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
```

Section: full-width, `py-24`, centered, max-width 800px

---

### Task 3.5 — Redesign CTA Section and Footer

**Status:** ⬜ Not Started
**Priority:** P3
**Estimated scope:** 2 files

1. **Final CTA section** in landing page: Full-width, centered, large headline "Ready to maximize your points?", `pm-button` CTA, `py-32`

2. **Footer** (`src/components/Footer.tsx`): Update styles for dark theme (should largely work already with CSS variables, but verify and adjust spacing/colors if needed)

---

## PHASE 4: Component Polish & Animations

> **Goal:** Build reusable animation components and polish interactive elements.

---

### Task 4.1 — Create SectionReveal Component

**Status:** ⬜ Not Started
**Priority:** P4
**Estimated scope:** 1 new file

**Create:** `src/components/ui/SectionReveal.tsx`

```tsx
'use client';
import { motion, useInView } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

interface SectionRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function SectionReveal({ children, className, delay = 0 }: SectionRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

Add `prefers-reduced-motion` support:
```tsx
const prefersReducedMotion = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

// If reduced motion, skip animation (render children directly)
```

**Acceptance criteria:**
- [ ] Component wraps any section and fades it in when scrolled into view
- [ ] `once: true` — animation only plays once
- [ ] Respects `prefers-reduced-motion`
- [ ] Exported from component file

---

### Task 4.2 — Create GlowButton Component

**Status:** ⬜ Not Started
**Priority:** P4
**Estimated scope:** 1 new file

**Create:** `src/components/ui/GlowButton.tsx`

```tsx
'use client';
import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  showArrow?: boolean;
  variant?: 'primary' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
}

export function GlowButton({
  children,
  showArrow = true,
  variant = 'primary',
  size = 'default',
  className,
  ...props
}: GlowButtonProps) {
  const baseClasses = 'inline-flex items-center gap-2 font-semibold rounded-full transition-all duration-200 group';

  const variantClasses = {
    primary: 'bg-pm-accent text-pm-bg hover:bg-pm-accent-strong hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0',
    secondary: 'bg-pm-surface text-pm-ink-900 border border-pm-border-strong hover:bg-pm-surface-soft hover:border-pm-accent',
  };

  const sizeClasses = {
    sm: 'px-5 py-2.5 text-sm',
    default: 'px-7 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className ?? ''}`}
      {...props}
    >
      {children}
      {showArrow && (
        <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
      )}
    </button>
  );
}
```

**Acceptance criteria:**
- [ ] Primary variant has teal glow on hover
- [ ] Arrow slides right on hover
- [ ] Secondary variant has border highlight on hover
- [ ] Works as a drop-in button replacement

---

### Task 4.3 — Create GlassCard Component

**Status:** ⬜ Not Started
**Priority:** P4
**Estimated scope:** 1 new file

**Create:** `src/components/ui/GlassCard.tsx`

```tsx
import { type ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={`
        bg-pm-surface/70
        backdrop-blur-xl
        border border-white/[0.08]
        rounded-3xl
        shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]
        ${className ?? ''}
      `}
    >
      {children}
    </div>
  );
}
```

**Acceptance criteria:**
- [ ] Glass effect visible on dark backgrounds
- [ ] Content behind card is blurred
- [ ] Border is subtle but visible

---

### Task 4.4 — Add prefers-reduced-motion Global Support

**Status:** ⬜ Not Started
**Priority:** P4
**Estimated scope:** 1 file

**File:** `src/app/globals.css`

Add at the top level (not inside a layer):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Acceptance criteria:**
- [ ] With OS "reduce motion" enabled, all CSS animations and transitions are disabled
- [ ] Framer Motion animations should also check (handled in SectionReveal component)

---

## PHASE 5: Apply Dark Theme to All Tool Pages

> **Goal:** After the design tokens are dark-first and components updated, verify each tool page looks correct. Most should "just work" after Phase 0+1, but some may need layout tweaks.

---

### Task 5.1 — Visual QA Pass on All Pages

**Status:** ⬜ Not Started
**Priority:** P5 — Requires Phase 0 + Phase 1 complete
**Estimated scope:** All pages

**What to do:**

Visit every page in the app and verify:
1. Dark mode renders correctly (no white flashes, no unreadable text)
2. Light mode toggle works and looks correct
3. All interactive elements (buttons, inputs, dropdowns, calendars) are themed
4. Loading skeletons are themed
5. Error states are themed
6. shadcn/ui components (Dialog, Popover, Select, etc.) work with dark theme

**Pages to check:**
- [ ] Landing page (`/us/`, `/in/`)
- [ ] Calculator (`/us/calculator`)
- [ ] Award Search (`/us/award-search`)
- [ ] Inspire (`/us/inspire`)
- [ ] Trip Builder (`/us/trip-builder`)
- [ ] Earning Calculator (`/us/earning-calculator`)
- [ ] Card Recommender (`/us/card-recommender`)
- [ ] Profile (`/profile`)
- [ ] How It Works (`/us/how-it-works`)
- [ ] Pricing (`/us/pricing`)
- [ ] Cards listing + detail (`/us/cards`, `/us/cards/[slug]`)
- [ ] Programs listing + detail (`/us/programs`, `/us/programs/[slug]`)
- [ ] Terms, Privacy
- [ ] Shared trip page (`/us/trips/[id]`)

**Fix any remaining visual issues found during QA.**

**Acceptance criteria:**
- [ ] All pages render correctly in dark mode
- [ ] All pages render correctly in light mode
- [ ] No hardcoded colors visible (check with browser dev tools)
- [ ] `npm run build` passes
- [ ] `npm run test` passes

---

## Progress Tracking

| Phase | Task | Status | Commit |
|---|---|---|---|
| 0 | 0.1 Add missing tokens | ⬜ | |
| 0 | 0.2 Fix globals.css components | ⬜ | |
| 0 | 0.3 Fix award-search | ⬜ | |
| 0 | 0.4 Fix trip-builder | ⬜ | |
| 0 | 0.5 Fix card-recommender | ⬜ | |
| 0 | 0.6 Fix inspire | ⬜ | |
| 0 | 0.7 Fix earning-calculator | ⬜ | |
| 0 | 0.8 Fix calculator components | ⬜ | |
| 0 | 0.9 Fix profile | ⬜ | |
| 0 | 0.10 Fix remaining files | ⬜ | |
| 1 | 1.1 Dark-first color system | ⬜ | |
| 1 | 1.2 Update component classes | ⬜ | |
| 1 | 1.3 Add navbar-height var | ⬜ | |
| 2 | 2.1 Redesign NavBar | ⬜ | |
| 3 | 3.1 Redesign hero | ⬜ | |
| 3 | 3.2 Trust stats strip | ⬜ | |
| 3 | 3.3 Feature sections | ⬜ | |
| 3 | 3.4 Calculator preview | ⬜ | |
| 3 | 3.5 CTA + footer | ⬜ | |
| 4 | 4.1 SectionReveal component | ⬜ | |
| 4 | 4.2 GlowButton component | ⬜ | |
| 4 | 4.3 GlassCard component | ⬜ | |
| 4 | 4.4 Reduced motion support | ⬜ | |
| 5 | 5.1 Visual QA all pages | ⬜ | |

---

## Rules for Kimi

1. **One commit per task.** Each task gets its own commit with the suggested message.
2. **Run `npm run build` after every task.** Do not move to the next task if build fails.
3. **Do not change functionality.** Only change visual/styling code. If a component has business logic interleaved with styling, only touch the className/style attributes.
4. **Do not touch these files:** `apple-icon.tsx`, `icon.tsx`, `opengraph-image.tsx`, anything in `src/app/admin/`
5. **Phase order matters.** Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5. Do not skip ahead.
6. **When in doubt about a hex → token mapping,** check the mapping table in Phase 0 / Task 0.3. If a hex value doesn't clearly map to a token, use the closest semantic match and note it in the commit message.
7. **Test both themes.** After each task, verify the page looks correct in both dark and light mode.

---

**Document End**
