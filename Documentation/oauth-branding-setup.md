# OAuth Branding Setup

## Problem
If Google OAuth shows `project-ref.supabase.co` instead of `pointsmax.com`, the app code is not the main issue. The visible approval/callback host comes from the Supabase Auth domain used by the OAuth flow.

## What the frontend already does
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/lib/auth-context.tsx` sends Google sign-in to Supabase with:
  - `redirectTo = ${window.location.origin}/auth/callback`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/auth/callback/route.ts` exchanges the code and returns the user to the app.

That means the browser returns to PointsMax after auth, but the OAuth approval/callback host shown during the provider flow is still controlled by Supabase Auth.

## Required fix
Use a branded/custom Supabase Auth domain instead of the raw `*.supabase.co` project domain.

## Checklist
1. Configure a custom domain for Supabase Auth / project traffic.
   - Target outcome: users see a PointsMax-owned domain such as `auth.pointsmax.com`.
2. Update `NEXT_PUBLIC_SUPABASE_URL` to the branded domain once the custom domain is live.
3. In Supabase Auth settings:
   - set `Site URL` to the canonical app URL, e.g. `https://pointsmax.com`
   - add redirect URLs:
     - `https://pointsmax.com/auth/callback`
     - `https://www.pointsmax.com/auth/callback` if used
     - local/dev callback URLs as needed
4. In Google Cloud OAuth credentials:
   - add the Supabase callback URL for the branded domain, e.g.
     - `https://auth.pointsmax.com/auth/v1/callback`
   - remove stale callback URLs if they are no longer used
5. Re-test the flow from a signed-out browser session.

## Important constraint
If Supabase Auth is still running on `project-ref.supabase.co`, Google will continue showing the Supabase domain during the approval flow. This cannot be hidden purely with a frontend code change.

## Operational check
The admin workflow health page now reports whether OAuth is still using a raw `supabase.co` domain:
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/admin/workflow-health/page.tsx`
- `/Users/adityaaggarwal/Desktop/Duke/Claude/pointsmax/src/app/api/admin/workflow-health/route.ts`
