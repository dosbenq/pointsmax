# PointsMax Feature Consolidation Plan

## Core product jobs

PointsMax should present only three core customer-facing product surfaces:

1. `Planner`
   - Primary page: `/[region]/calculator`
   - Supporting pages:
     - `/[region]/award-search`
     - `/[region]/trip-builder`
     - `/[region]/inspire`
   - Customer job:
     - decide how to use existing points
     - compare redemption paths
     - verify reachable routes
     - build a booking path

2. `Card Strategy`
   - Primary page: `/[region]/card-recommender`
   - Supporting pages:
     - `/[region]/earning-calculator`
     - `/[region]/cards`
   - Customer job:
     - decide what card comes next
     - compare earning potential
     - understand the card universe

3. `Wallet`
   - Primary page: `/[region]/profile`
   - Supporting capabilities:
     - balances
     - connected accounts
     - alerts
     - subscription/billing
   - Customer job:
     - manage what PointsMax knows about the user
     - keep balances and watches current

## Demotions

These should not be treated as primary product features in the main IA:

- `award-search`
- `trip-builder`
- `inspire`
- `earning-calculator`
- `cards`
- `programs`
- `how-it-works`

They should remain accessible, but as:

- subflows
- support pages
- directory/SEO pages
- educational pages

## IA rule

Primary navigation should describe customer jobs, not internal tools.

That means the primary nav should expose:

- `Planner`
- `Card Strategy`
- `Wallet`

Everything else should be linked contextually from inside those flows or demoted to footer/support surfaces.

## UX implications

- The landing page should route users by job-to-be-done, not by tool list.
- The planner flow should feel like one family of decisions, even if multiple routes/pages still exist technically.
- The card experience should feel like one strategic surface, with earning math and card directories serving as support.
- Wallet should become the home for balances, connectors, alerts, and account state.
