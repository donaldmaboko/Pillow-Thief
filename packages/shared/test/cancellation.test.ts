import { describe, expect, it } from 'vitest'
import { DEFAULT_CANCELLATION_POLICY, decideRefund } from '../src/cancellation'

describe('cancellation policy', () => {
  const p = DEFAULT_CANCELLATION_POLICY

  it('gives a full refund outside 24 hours', () => {
    expect(decideRefund(p, 48).refundPercent).toBe(100)
    expect(decideRefund(p, 24).refundPercent).toBe(100)
  })

  it('gives a partial refund in the 6-24 hour window', () => {
    const d = decideRefund(p, 12)
    expect(d.refundPercent).toBe(50)
    expect(d.reason).toBe('partial_refund_window')
  })

  it('gives no refund within 6 hours', () => {
    expect(decideRefund(p, 3).refundPercent).toBe(0)
  })

  it('always refunds fully when the provider initiates the cancellation', () => {
    expect(decideRefund(p, 0.5, { providerInitiated: true }).refundPercent).toBe(100)
  })
})
