import { describe, expect, it } from 'vitest'
import { addMoney, applyBasisPoints, formatMoney, fromMajor, money, multiplyMoney } from '../src/money'

describe('money', () => {
  it('stores amounts as integer minor units (thebe)', () => {
    const m = fromMajor(250, 'BWP')
    expect(m.amount).toBe(25000)
    expect(m.currency).toBe('BWP')
  })

  it('rejects non-integer minor unit construction', () => {
    expect(() => money(10.5, 'BWP')).toThrow()
  })

  it('adds amounts in the same currency', () => {
    expect(addMoney(money(100, 'BWP'), money(250, 'BWP')).amount).toBe(350)
  })

  it('rejects adding different currencies', () => {
    expect(() => addMoney(money(100, 'BWP'), money(100, 'USD'))).toThrow(/mismatch/)
  })

  it('rounds basis point math deterministically', () => {
    // 15% of P100.00 (10000 thebe) = 1500 thebe
    expect(applyBasisPoints(money(10000, 'BWP'), 1500).amount).toBe(1500)
    // 15% of 333 thebe = 49.95 -> 50 thebe (half-up)
    expect(applyBasisPoints(money(333, 'BWP'), 1500).amount).toBe(50)
  })

  it('multiplies and rounds money half-up', () => {
    expect(multiplyMoney(money(100, 'BWP'), 1.5).amount).toBe(150)
    expect(multiplyMoney(money(201, 'BWP'), 1.5).amount).toBe(302)
  })

  it('formats pula for display', () => {
    expect(formatMoney(fromMajor(250, 'BWP'))).toBe('P250.00')
    expect(formatMoney(money(0, 'BWP'))).toBe('P0.00')
  })
})
