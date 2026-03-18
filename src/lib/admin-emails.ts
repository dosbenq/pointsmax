function parseEmailList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.includes('@'))
}

export function getAllowedAdminEmailsForServer(): string[] {
  const allowlist = parseEmailList(process.env.ADMIN_ALLOWED_EMAILS)
  if (allowlist.length > 0) return allowlist
  return parseEmailList(process.env.ADMIN_EMAIL)
}

export function getAllowedAdminEmailsForClient(): string[] {
  const allowlist = parseEmailList(process.env.NEXT_PUBLIC_ADMIN_ALLOWED_EMAILS)
  if (allowlist.length > 0) return allowlist
  return parseEmailList(process.env.NEXT_PUBLIC_ADMIN_EMAIL)
}

export function isServerAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getAllowedAdminEmailsForServer().includes(email.trim().toLowerCase())
}

export function isClientAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getAllowedAdminEmailsForClient().includes(email.trim().toLowerCase())
}
