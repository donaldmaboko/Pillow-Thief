/**
 * Cancellation & refund policy.
 *
 * Default platform policy (providers may tighten within platform limits,
 * never loosen past the platform floor). Refund percentages are applied to
 * the amount actually paid (session + travel + fees), in minor units.
 */

export interface CancellationPolicy {
  /** Hours before session start for a full refund. */
  fullRefundBeforeHours: number
  /** Hours before session start for the partial-refund tier. */
  partialRefundBeforeHours: number
  /** Refund percentage (0-100) inside the partial window. */
  partialRefundPercent: number
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  fullRefundBeforeHours: 24,
  partialRefundBeforeHours: 6,
  partialRefundPercent: 50,
}

/** Platform floor: providers cannot offer less than this. */
export const MINIMUM_CANCELLATION_POLICY: CancellationPolicy = {
  fullRefundBeforeHours: 2,
  partialRefundBeforeHours: 1,
  partialRefundPercent: 25,
}

export function clampPolicyToFloor(policy: CancellationPolicy): CancellationPolicy {
  return {
    fullRefundBeforeHours: Math.min(policy.fullRefundBeforeHours, DEFAULT_CANCELLATION_POLICY.fullRefundBeforeHours),
    partialRefundBeforeHours: Math.min(policy.partialRefundBeforeHours, DEFAULT_CANCELLATION_POLICY.partialRefundBeforeHours),
    partialRefundPercent: Math.max(policy.partialRefundPercent, MINIMUM_CANCELLATION_POLICY.partialRefundPercent),
  }
}

export interface RefundDecision {
  /** Percentage of paid amount refunded (0-100). */
  refundPercent: number
  reason: 'full_refund_window' | 'partial_refund_window' | 'late_cancellation' | 'provider_initiated'
}

/**
 * Compute refund entitlement. `providerInitiated` cancellations (decline,
 * safety stop, platform action) always refund 100%.
 */
export function decideRefund(
  policy: CancellationPolicy,
  hoursBeforeStart: number,
  opts: { providerInitiated?: boolean } = {},
): RefundDecision {
  if (opts.providerInitiated) return { refundPercent: 100, reason: 'provider_initiated' }
  if (hoursBeforeStart < 0) return { refundPercent: 0, reason: 'late_cancellation' }
  if (hoursBeforeStart >= policy.fullRefundBeforeHours) return { refundPercent: 100, reason: 'full_refund_window' }
  if (hoursBeforeStart >= policy.partialRefundBeforeHours) {
    return { refundPercent: policy.partialRefundPercent, reason: 'partial_refund_window' }
  }
  return { refundPercent: 0, reason: 'late_cancellation' }
}

/**
 * Whether a client-facing cancel action is allowed at all for a booking that
 * starts `hoursBeforeStart` from now. Hard cutoff: once the session is in
 * progress, cancellation is handled through support/safety tools instead.
 */
export function canClientCancel(hoursBeforeStart: number): boolean {
  return hoursBeforeStart > 0
}
