# PointsMax UI Reset Brief

## Summary

The current UI is not failing because of a lack of components. It is failing because the product has a generic component language, weak information hierarchy, and no strong editorial or luxury visual point of view.

The result is a product that feels "AI-generated":

- every page uses the same `pm-card` / `pm-button` / `pm-input` treatment
- everything is visually weighted the same way
- dark teal glassmorphism dominates the brand instead of supporting it
- the calculator is still a dense tool surface, not a premium decision flow
- the landing page communicates features, not aspiration and trust
- pages are technically cleaner than before, but the design system still pushes them toward the same interchangeable SaaS look

This brief defines the reset direction so future UI work does not become another cosmetic iteration.

## What Is Going Wrong

### 1. Theme-Level Homogeneity

The global theme in `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/globals.css` is still anchored around:

- default dark mode
- teal-on-charcoal palette
- glass panels
- soft glowing accents
- rounded pills and rounded cards everywhere

That combination is now common across AI tools, crypto dashboards, and generic SaaS templates. It signals "app UI" but not "premium travel advisor."

### 2. Repeated Container Pattern

Across the app, major surfaces are built from the same primitives:

- `pm-page-header`
- `pm-shell`
- `pm-card`
- `pm-card-soft`
- `pm-button`
- `pm-input`

This causes:

- landing, calculator, profile, award search, and card recommender to look like variants of the same admin screen
- no clear difference between narrative sections, forms, result cards, alerts, and secondary utilities
- weak visual rhythm

### 3. Calculator Is Still Tool-First, Not Decision-First

The calculator page has been refactored technically, but not reimagined as an experience. It still reads as:

- header
- steps
- form panels
- results panels
- auxiliary widgets

This is structurally clean, but it does not feel like a premium consumer product. Customers want:

- fast orientation
- one obvious primary action
- an immediate sense of "what to do next"
- confidence that the app is making a judgment, not just listing numbers

### 4. Landing Page Is Showing Mocks, Not Selling a Position

The landing page in `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/[region]/page.tsx` is competent, but it still behaves like a startup explainer. It shows mock cards and process steps instead of building:

- aspiration
- authority
- taste
- trust
- urgency

For this category, the product should feel closer to a premium travel publication or concierge service than a dashboard homepage.

### 5. Navigation Is Functional But Not Premium

The navbar in `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/components/NavBar.tsx` is efficient, but visually it is still:

- logo
- pills
- theme toggle
- auth CTA

This feels product-generic. It does not create brand memory.

### 6. Tech Debt Is Still Influencing Design

We are still seeing UI decisions shaped by existing code structure:

- large page components
- generic theme classes reused everywhere
- feature teams shipping inside current patterns instead of defining new ones
- design changes constrained by existing utility class composition

So yes, this is partially a design issue and partially architecture debt.

## Design Goal

PointsMax should feel like:

- a premium travel decision product
- authoritative, not noisy
- luxurious, not flashy
- editorial, not "AI dashboard"
- high-conviction, not template-derived

The emotional target is:

"This product understands expensive travel, rewards strategy, and taste."

Not:

"This is a smart calculator with modern UI components."

## New Visual Direction

### Core Aesthetic

Move away from:

- dark-first default
- teal-glow UI
- soft glassmorphism
- uniform rounded panels

Move toward:

- light-first premium editorial palette
- warm neutrals with one controlled accent
- stronger typography contrast
- harder hierarchy between hero / tools / supporting content
- less decorative glow, more restraint

### Recommended Palette

Base direction:

- background: ivory / parchment / stone, not bright white
- surface: warm white
- text: near-black with deep olive or charcoal undertones
- accent: one luxury accent, likely dark forest, oxblood, or deep gold
- success/warning/danger remain functional, but de-emphasized

Avoid:

- bright teal as brand anchor
- purple
- neon gradients
- frosted-glass default panels

### Typography Direction

Current typography is too product-neutral.

Recommended split:

- display/headlines: editorial serif or high-character display face
- UI/body: a restrained grotesk or text face

The point is not novelty. The point is contrast and intention.

Headlines should feel like a luxury travel cover line, not a dashboard heading.

### Surface System

We should stop using one card pattern for everything.

Introduce 4 distinct surface types:

1. Narrative sections
- used for landing page storytelling and trust blocks
- more whitespace, stronger type, fewer borders

2. Utility panels
- used for forms and settings
- quiet, compact, structured

3. Judgment/result cards
- used for recommendations and best redemption outputs
- higher contrast, stronger visual priority, clearer status logic

4. Secondary evidence blocks
- assumptions, details, caveats, metrics
- lighter, subordinate, collapsible where possible

## Information Architecture Reset

### Landing Page

The landing page should answer this order, not the current process order:

1. Why should I trust this?
2. What does it do for me right now?
3. Why is it better than generic points tools?
4. What can I do first?

Recommended structure:

1. Hero
- premium headline
- single primary CTA
- one strong proof statement
- one visual artifact that feels real, not mocked

2. Authority band
- trust markers
- real metrics
- partner/program coverage

3. Core product proposition
- "your wallet -> your best move"

4. Product surfaces
- calculator
- trip builder
- card recommender
- alerts

5. Differentiation section
- explicit competitor contrast

6. Final CTA

### Calculator

The calculator should become a guided premium workflow, not a collection of stacked modules.

Recommended layout:

1. Hero strip
- one sentence
- one chosen mode
- minimal chrome

2. Primary left rail
- balances
- objective
- constraints

3. Sticky right rail
- live recommendation summary
- expected value
- best move
- next action

4. Result stage
- one featured recommendation
- then ranked alternatives
- then assumptions / AI / alerts

The current calculator still treats all modules as peers. That is the main experience mistake.

### Card Recommender

The V2 logic is moving in the right direction, but the layout should feel more like a strategist's memo than a filter form.

Recommended structure:

1. Recommendation mode selector
2. Compact intake
3. One featured card with reasoning
4. Two alternative paths
5. "Not recommended right now"
6. Rule/explanation drawer

Avoid long vertical stacks of equally styled option cards.

## Product-Level UI Principles

These should govern every redesign decision:

1. One primary action per screen
- do not show three equal CTAs in the same zone unless one is clearly secondary

2. One hero judgment per result view
- featured recommendation first, lists later

3. Hide mechanical detail by default
- users should see the answer before the machinery

4. Fewer pills, fewer borders, fewer tinted boxes
- current UI overuses all three

5. Stronger spacing contrast
- premium interfaces use whitespace aggressively

6. Stronger typographic contrast
- section labels, headings, explanations, metrics should not all feel similar

7. Every section must justify its existence
- if a panel does not change the user decision, it should be collapsed, moved, or removed

## Technical Reset Required

This should not be done as a pure CSS pass.

### Problems

- `pm-*` global classes are too generic and too dominant
- pages still compose too much presentation inline
- the design system does not encode hierarchy, only styling
- existing components are reused because they are available, not because they are correct

### Required Architecture Changes

1. Create a real design-system layer under feature-agnostic UI primitives

Suggested structure:

- `src/components/ui/primitives/`
- `src/components/ui/layout/`
- `src/components/ui/marketing/`
- `src/components/ui/decision/`
- `src/components/ui/forms/`

2. Replace generic `pm-card` dependency with named surfaces

Examples:

- `NarrativePanel`
- `UtilityPanel`
- `FeaturedDecisionCard`
- `EvidenceBlock`

3. Split theme tokens into:

- brand tokens
- semantic UI tokens
- surface-specific tokens

4. Move from "default dark mode" to "intentional light-first with optional dark mode"

## Recommended Implementation Sequence

### Phase 1: Visual System Reset

Files:

- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/globals.css`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/components/NavBar.tsx`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/components/Footer.tsx`

Deliverables:

- new light-first token system
- typography reset
- navbar redesign
- surface taxonomy

### Phase 2: Landing Page Rewrite

Files:

- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/[region]/page.tsx`

Deliverables:

- new hero
- authority band
- differentiated product framing
- real premium tone

### Phase 3: Calculator Experience Redesign

Files:

- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/[region]/calculator/page.tsx`
- calculator child components and shell feature

Deliverables:

- decision-first layout
- featured recommendation rail
- calmer form structure
- reduced visual clutter

### Phase 4: Tool Surface Harmonization

Files:

- award search
- trip builder
- card recommender
- profile

Deliverables:

- coherent visual language
- differentiated section hierarchy
- less repetitive panel structure

## Definition of Done

The redesign is successful when:

- the product no longer looks like a generic AI or fintech dashboard
- the calculator feels like a guided premium decision experience
- landing communicates aspiration and authority immediately
- result screens emphasize judgment before mechanics
- color, spacing, type, and surfaces feel intentional and memorable

## Immediate Recommendation

Do not start with isolated tweaks to card borders, shadows, or gradients.

Start with:

1. visual system reset
2. landing page rewrite
3. calculator layout rethink

If we skip that order, we will keep polishing the wrong structure.
