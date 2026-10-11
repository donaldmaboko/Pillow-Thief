/**
 * Structured error handling shared across mobile, edge functions, and admin.
 */

export type PillowErrorCode =
  | 'auth_required'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'booking_conflict'
  | 'availability_unavailable'
  | 'provider_not_approved'
  | 'payment_failed'
  | 'payment_not_verified'
  | 'meeting_location_invalid'
  | 'travel_out_of_range'
  | 'consent_required'
  | 'review_not_eligible'
  | 'rate_limited'
  | 'external_service'
  | 'internal'

export class PillowError extends Error {
  readonly code: PillowErrorCode
  readonly status: number
  readonly details?: unknown

  constructor(code: PillowErrorCode, message: string, opts: { status?: number; details?: unknown } = {}) {
    super(message)
    this.name = 'PillowError'
    this.code = code
    this.status = opts.status ?? codeToStatus(code)
    this.details = opts.details
  }

  toJSON(): { code: PillowErrorCode; message: string; details?: unknown } {
    return { code: this.code, message: this.message, details: this.details }
  }
}

function codeToStatus(code: PillowErrorCode): number {
  switch (code) {
    case 'auth_required':
      return 401
    case 'forbidden':
      return 403
    case 'not_found':
    case 'review_not_eligible':
      return 404
    case 'validation':
    case 'consent_required':
      return 422
    case 'booking_conflict':
    case 'availability_unavailable':
    case 'meeting_location_invalid':
    case 'travel_out_of_range':
    case 'provider_not_approved':
      return 409
    case 'payment_failed':
    case 'payment_not_verified':
      return 402
    case 'rate_limited':
      return 429
    case 'external_service':
      return 502
    default:
      return 500
  }
}

export function toHttpErrorPayload(err: unknown): { status: number; body: { error: object } } {
  if (err instanceof PillowError) {
    return { status: err.status, body: { error: err.toJSON() } }
  }
  const message = err instanceof Error ? err.message : 'Unexpected error'
  return { status: 500, body: { error: new PillowError('internal', message).toJSON() } }
}
