import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { latestValuations, programs, transferPartners } from '@/lib/db/schema'
import type { ProgramRow, TransferPartnerRow, ValuationRow } from './types'

export type AwardCatalog = {
  transferPartners: TransferPartnerRow[]
  programs: ProgramRow[]
  valuations: ValuationRow[]
}

/** Programmes, active transfer routes and latest valuations used by award search. */
export async function loadAwardCatalog(): Promise<AwardCatalog> {
  const db = getDb()
  const [partnerRows, programRows, valuationRows] = await Promise.all([
    db.select({
      id: transferPartners.id,
      from_program_id: transferPartners.fromProgramId,
      to_program_id: transferPartners.toProgramId,
      ratio_from: transferPartners.ratioFrom,
      ratio_to: transferPartners.ratioTo,
      is_instant: transferPartners.isInstant,
      transfer_time_max_hrs: transferPartners.transferTimeMaxHrs,
    }).from(transferPartners).where(eq(transferPartners.isActive, true)),
    db.select({
      id: programs.id,
      name: programs.name,
      short_name: programs.shortName,
      slug: programs.slug,
      color_hex: programs.colorHex,
      type: programs.type,
    }).from(programs),
    db.select({
      program_id: latestValuations.programId,
      cpp_cents: latestValuations.cppCents,
      program_name: latestValuations.programName,
      program_slug: latestValuations.programSlug,
      program_type: latestValuations.programType,
    }).from(latestValuations),
  ])
  return {
    transferPartners: partnerRows,
    programs: programRows as ProgramRow[],
    valuations: valuationRows as ValuationRow[],
  }
}
