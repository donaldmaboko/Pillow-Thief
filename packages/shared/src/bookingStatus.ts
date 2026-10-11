/**
 * Canonical booking status machine.
 *
 * These statuses and transitions are enforced in three places:
 *  1. Here (shared validation, used by clients for UI gating),
 *  2. In PostgreSQL (exclusion constraints + transition checks),
 *  3. In Edge Functions (authoritative server enforcement).
 *
 * Hiding a button in the UI is NEVER treated as access control.
 */

export const BOOKING_STATUSES = [
  'draft',
  'pending_payment',
  'pending_approval',
  'confirmed',
  'in_progress',
  'completed',
  'declined',
  'cancelled',
  'expired',
  'disputed',
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

/**
 * Legal forward transitions. Anything not listed here is rejected
 * server-side regardless of what a client submits.
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  draft: ['pending_payment', 'pending_approval', 'expired', 'cancelled'],
  pending_payment: ['pending_approval', 'confirmed', 'expired', 'cancelled'],
  pending_approval: ['confirmed', 'declined', 'expired', 'cancelled'],
  confirmed: ['in_progress', 'completed', 'cancelled', 'disputed'],
  in_progress: ['completed', 'disputed'],
  completed: ['disputed'],
  declined: [],
  cancelled: [],
  expired: [],
  disputed: ['completed', 'cancelled'],
}

/** Statuses that occupy a provider's calendar (used for conflict detection). */
export const BLOCKING_STATUSES: readonly BookingStatus[] = [
  'pending_payment',
  'pending_approval',
  'confirmed',
  'in_progress',
]

/** Statuses for which a client may cancel (subject to the cancellation policy). */
export const CLIENT_CANCELLABLE_STATUSES: readonly BookingStatus[] = [
  'draft',
  'pending_payment',
  'pending_approval',
  'confirmed',
]

export function isBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as readonly string[]).includes(value)
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false
}

export function isBlockingStatus(status: BookingStatus): boolean {
  return BLOCKING_STATUSES.includes(status)
}

/**
 * Human readable labels for UI. Kept here so mobile + admin stay consistent.
 */
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  draft: 'Draft',
  pending_payment: 'Pending payment',
  pending_approval: 'Awaiting provider approval',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  expired: 'Expired',
  disputed: 'Disputed',
}

/** Ordered statuses that count as a successful booking for review eligibility. */
export const REVIEW_ELIGIBLE_STATUSES: readonly BookingStatus[] = ['completed']
