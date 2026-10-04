'use client'

import { createAuthClient } from 'better-auth/react'

// Same-origin: Better Auth's endpoints are served from /api/auth/*.
export const authClient = createAuthClient()
