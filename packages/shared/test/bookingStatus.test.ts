import { describe, expect, it } from 'vitest'
import {
  BLOCKING_STATUSES,
  canTransition,
  isBlockingStatus,
  isBookingStatus,
} from '../src/bookingStatus'

describe('booking status machine', () => {
  it('recognises valid statuses', () => {
    expect(isBookingStatus('confirmed')).toBe(true)
    expect(isBookingStatus('hacked_status')).toBe(false)
  })

  it('allows legal transitions', () => {
    expect(canTransition('pending_approval', 'confirmed')).toBe(true)
    expect(canTransition('pending_approval', 'declined')).toBe(true)
    expect(canTransition('confirmed', 'in_progress')).toBe(true)
    expect(canTransition('in_progress', 'completed')).toBe(true)
    expect(canTransition('completed', 'disputed')).toBe(true)
  })

  it('blocks illegal transitions', () => {
    // A completed booking cannot jump back to confirmed or pending.
    expect(canTransition('completed', 'confirmed')).toBe(false)
    // A declined booking is terminal.
    expect(canTransition('declined', 'confirmed')).toBe(false)
    // Cannot go straight from draft to completed.
    expect(canTransition('draft', 'completed')).toBe(false)
    // Cannot skip approval to in_progress.
    expect(canTransition('pending_approval', 'in_progress')).toBe(false)
  })

  it('flags statuses that occupy provider calendars', () => {
    expect(isBlockingStatus('confirmed')).toBe(true)
    expect(isBlockingStatus('pending_approval')).toBe(true)
    expect(isBlockingStatus('completed')).toBe(false)
    expect(BLOCKING_STATUSES).not.toContain('cancelled')
  })
})
