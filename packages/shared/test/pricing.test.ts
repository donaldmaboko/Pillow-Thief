import { describe, expect, it } from 'vitest'
import { buildQuote, earningsBreakdown, quoteTravelFee } from '../src/pricing'

describe('buildQuote', () => {
  it('computes a full price breakdown in minor units', () => {
    const q = buildQuote({
      servicePriceMinor: 30000, // P300 for 60 min
      currency: 'BWP',
      travelFeeMinor: 5000, // P50 travel
      bookingFeeMinor: 2000, // P20 booking fee
      taxRateBps: 0,
    })
    expect(q.total.amount).toBe(37000)
    expect(q.total.currency).toBe('BWP')
    expect(q.lineItems.map((l) => l.key)).toEqual(['session', 'travel', 'booking_fee'])
  })

  it('applies tax on the subtotal and discount last', () => {
    const q = buildQuote({
      servicePriceMinor: 10000,
      currency: 'BWP',
      travelFeeMinor: 0,
      bookingFeeMinor: 0,
      taxRateBps: 1400, // 14% VAT
      discountMinor: 1000,
    })
    // subtotal = 10000; tax = 1400; total = 11400; discount 1000 -> 10400
    expect(q.total.amount).toBe(10400)
  })

  it('never lets a discount push the total below zero', () => {
    const q = buildQuote({
      servicePriceMinor: 500,
      currency: 'BWP',
      travelFeeMinor: 0,
      bookingFeeMinor: 0,
      taxRateBps: 0,
      discountMinor: 99999,
    })
    expect(q.total.amount).toBe(0)
  })
})

describe('earningsBreakdown', () => {
  it('splits gross into commission and net provider earnings', () => {
    const e = earningsBreakdown({ grossMinor: 30000, currency: 'BWP', commissionBps: 1500 })
    expect(e.commission.amount).toBe(4500)
    expect(e.net.amount).toBe(25500)
  })
})

describe('quoteTravelFee', () => {
  it('charges base + per-km within the provider range', () => {
    const r = quoteTravelFee({ distanceKm: 10, baseFeeMinor: 3000, perKmMinor: 500, maxTravelKm: 25 })
    expect(r.withinRange).toBe(true)
    expect(r.feeMinor).toBe(3000 + 10 * 500)
  })

  it('rejects distances beyond the provider max travel radius', () => {
    const r = quoteTravelFee({ distanceKm: 30, baseFeeMinor: 3000, perKmMinor: 500, maxTravelKm: 25 })
    expect(r.withinRange).toBe(false)
  })
})
