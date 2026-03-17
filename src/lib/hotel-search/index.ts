import { ChartHotelProvider } from './chart-provider'
import type { HotelAwardProvider } from './types'

export function createHotelSearchProvider(): HotelAwardProvider {
  return new ChartHotelProvider()
}

export type {
  HotelAwardProvider,
  HotelDestinationRegion,
  HotelSearchParams,
  HotelSearchResult,
} from './types'
