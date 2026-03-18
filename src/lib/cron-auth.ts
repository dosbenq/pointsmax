export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  const header = req.headers.get('authorization')?.trim()
  return header === `Bearer ${secret}`
}
