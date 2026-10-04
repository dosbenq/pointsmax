import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { programNameAliases, programs } from '@/lib/db/schema'

export type MatchableProgram = { id: string; name: string; slug: string }
export type ProgramAlias = { alias: string; program_slug: string }

/** Active programmes plus name aliases, for matching imported balance rows. */
export async function loadProgramsAndAliases(): Promise<{ programs: MatchableProgram[]; aliases: ProgramAlias[] }> {
  const db = getDb()
  const [programRows, aliasRows] = await Promise.all([
    db.select({ id: programs.id, name: programs.name, slug: programs.slug })
      .from(programs)
      .where(eq(programs.isActive, true)),
    db.select({ alias: programNameAliases.alias, program_slug: programNameAliases.programSlug })
      .from(programNameAliases),
  ])
  return { programs: programRows, aliases: aliasRows }
}
