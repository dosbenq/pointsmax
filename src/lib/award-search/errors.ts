export class AwardProviderUnavailableError extends Error {
  constructor(message = 'Live award data is not configured. Add SEATS_AERO_API_KEY.') {
    super(message)
    this.name = 'AwardProviderUnavailableError'
  }
}
