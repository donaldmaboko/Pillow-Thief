/**
 * Server-authoritative pricing model.
 *
 * IMPORTANT: Clients may RENDER a quote but must never supply prices,
 * travel fees, or commission to the backend as trusted input. The backend
 * recomputes every line item from the database (service price, provider
 * travel zone, platform settings) before creating a payment.
 */

import { addMoney, applyBasisPoints, money, type Money } from './money'

export interface PriceLineItem {
  key: 'session' | 'travel' | 'booking_fee' | 'tax' | 'discount'
  label: string
  amount: Money
}

export interface QuoteInput {
  /** Service base price for the chosen duration, in minor units. */
  servicePriceMinor: number
  currency: string
  /** Travel fee computed server-side from the Routes API + provider zone. 0 if none. */
  travelFeeMinor: number
  /** Flat platform booking fee in minor units (from platform_settings). */
  bookingFeeMinor: number
  /** Tax rate in basis points (e.g. VAT 1400 = 14%). Applied to session+travel+fee. */
  taxRateBps: number
  /** Validated discount in minor units (from a checked promo code), never client-supplied. */
  discountMinor?: number
}

export interface QuoteResult {
  lineItems: PriceLineItem[]
  subtotal: Money
  total: Money
  /** Commission the platform retains on a completed booking (informational for admin/provider earnings). */
  commissionPreview?: Money
}

export function buildQuote(input: QuoteInput): QuoteResult {
  const currency = input.currency
  const session = money(input.servicePriceMinor, currency)
  const travel = money(input.travelFeeMinor, currency)
  const fee = money(input.bookingFeeMinor, currency)

  const lineItems: PriceLineItem[] = [
    { key: 'session', label: 'Session price', amount: session },
  ]
  if (travel.amount > 0) lineItems.push({ key: 'travel', label: 'Travel fee', amount: travel })
  if (fee.amount > 0) lineItems.push({ key: 'booking_fee', label: 'Booking fee', amount: fee })

  let subtotal = addMoney(addMoney(session, travel), fee)

  if (input.taxRateBps > 0) {
    const tax = applyBasisPoints(subtotal, input.taxRateBps)
    if (tax.amount > 0) lineItems.push({ key: 'tax', label: 'Tax', amount: tax })
    subtotal = addMoney(subtotal, tax)
  }

  let total = subtotal
  const discountMinor = input.discountMinor ?? 0
  if (discountMinor > 0) {
    const discount = money(Math.min(discountMinor, subtotal.amount), currency)
    lineItems.push({ key: 'discount', label: 'Discount', amount: money(-discount.amount, currency) })
    total = money(subtotal.amount - discount.amount, currency)
  }

  return { lineItems, subtotal, total }
}

export interface EarningsBreakdownInput {
  grossMinor: number
  currency: string
  commissionBps: number
  refundMinor?: number
  adjustmentMinor?: number
}

export interface EarningsBreakdown {
  gross: Money
  commission: Money
  refunds: Money
  adjustments: Money
  net: Money
}

/** Provider earnings = gross - platform commission - refunds + adjustments. */
export function earningsBreakdown(input: EarningsBreakdownInput): EarningsBreakdown {
  const gross = money(input.grossMinor, input.currency)
  const commission = applyBasisPoints(gross, input.commissionBps)
  const refunds = money(input.refundMinor ?? 0, input.currency)
  const adjustments = money(input.adjustmentMinor ?? 0, input.currency)
  const net = money(gross.amount - commission.amount - refunds.amount + adjustments.amount, input.currency)
  return { gross, commission, refunds, adjustments, net }
}

/**
 * Travel fee model. Providers configure per service area:
 *  - house_call_enabled
 *  - travel_base_fee_minor (call-out fee)
 *  - travel_per_km_minor (distance component)
 *  - max_travel_km
 * Distance comes from the Google Routes API on the server. We never trust
 * client-supplied distances.
 */
export interface TravelFeeInput {
  distanceKm: number
  baseFeeMinor: number
  perKmMinor: number
  maxTravelKm: number
}

export function quoteTravelFee(input: TravelFeeInput): { feeMinor: number; withinRange: boolean } {
  if (input.distanceKm < 0) throw new Error('distanceKm must be >= 0')
  const withinRange = input.distanceKm <= input.maxTravelKm
  if (!withinRange) return { feeMinor: 0, withinRange: false }
  const fee = input.baseFeeMinor + Math.round(input.distanceKm * input.perKmMinor)
  return { feeMinor: fee, withinRange: true }
}
