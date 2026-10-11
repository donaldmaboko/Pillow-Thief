/**
 * Money handling.
 *
 * All monetary amounts in Pillow Thief are stored as INTEGER MINOR UNITS
 * (thebe for Botswana pula, 100 thebe = P1). Floating point arithmetic is
 * never used for money anywhere in the stack.
 */

export const DEFAULT_CURRENCY = 'BWP'
export const MINOR_UNITS_PER_UNIT: Record<string, number> = {
  BWP: 100,
  USD: 100,
  ZAR: 100,
  EUR: 100,
}

export type Currency = string

export interface Money {
  /** Amount in minor units (thebe). Always an integer. */
  amount: number
  currency: Currency
}

export function minorUnitsPerUnit(currency: Currency): number {
  return MINOR_UNITS_PER_UNIT[currency] ?? 100
}

export function money(amount: number, currency: Currency = DEFAULT_CURRENCY): Money {
  if (!Number.isInteger(amount)) {
    throw new Error(`Money amount must be an integer number of minor units, got ${amount}`)
  }
  return { amount, currency }
}

export function fromMajor(units: number, currency: Currency = DEFAULT_CURRENCY): Money {
  const factor = minorUnitsPerUnit(currency)
  const minor = Math.round(units * factor)
  return money(minor, currency)
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount + b.amount, a.currency)
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount - b.amount, a.currency)
}

export function multiplyMoney(m: Money, factor: number): Money {
  if (!Number.isFinite(factor)) throw new Error('Money multiplier must be finite')
  return money(Math.round(m.amount * factor), m.currency)
}

/**
 * Apply a rate expressed in basis points (1/100 of a percent).
 * Platform commission is stored as basis points, e.g. 1500 = 15%.
 * Rounding: half-up, deterministic, matches the SQL implementation.
 */
export function applyBasisPoints(m: Money, bps: number): Money {
  if (!Number.isInteger(bps) || bps < 0) throw new Error('Basis points must be a non-negative integer')
  const value = (m.amount * bps) / 10_000
  return money(Math.round(value), m.currency)
}

export function isNonNegative(m: Money): boolean {
  return m.amount >= 0
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`)
  }
}

/**
 * Format for display, e.g. "P 250.00". Display-only — never parse money
 * back from formatted strings.
 */
export function formatMoney(m: Money, opts: { symbol?: string } = {}): string {
  const factor = minorUnitsPerUnit(m.currency)
  const major = m.amount / factor
  const sign = major < 0 ? '-' : ''
  const abs = Math.abs(major)
  const digits = factor >= 100 ? 2 : 0
  const formatted = abs.toLocaleString('en-BW', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  const symbol = opts.symbol ?? (m.currency === 'BWP' ? 'P' : `${m.currency} `)
  return `${sign}${symbol}${formatted}`
}
