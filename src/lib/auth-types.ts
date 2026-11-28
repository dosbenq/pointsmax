// Client-safe shape of the signed-in user (from Better Auth's session).
export type AppUser = {
  id: string
  email: string
  name: string | null
  image: string | null
  emailVerified: boolean
  createdAt: string
}
