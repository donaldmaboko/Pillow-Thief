/**
 * Consent & boundaries model.
 *
 * Consent is ONGOING: either participant may withdraw consent or end a
 * session at any time, for any reason, without penalty. This is a core
 * product rule, not just copy.
 */

import { z } from 'zod'

export const CONSENT_TOUCH_OPTIONS = ['yes', 'no', 'discuss_first'] as const
export type ConsentTouchOption = (typeof CONSENT_TOUCH_OPTIONS)[number]

export const CONSENT_CONTACT_AREAS = [
  'hugging',
  'hand_holding',
  'arm_around_shoulder',
  'head_on_shoulder',
  'cuddling_seated',
  'cuddling_lying_down',
  'hair_play',
  'back_rub_over_clothing',
] as const
export type ConsentContactArea = (typeof CONSENT_CONTACT_AREAS)[number]

export const CONSENT_CONTACT_LABELS: Record<ConsentContactArea, string> = {
  hugging: 'Hugging',
  hand_holding: 'Hand holding',
  arm_around_shoulder: 'Arm around shoulder',
  head_on_shoulder: 'Head on shoulder',
  cuddling_seated: 'Cuddling, seated',
  cuddling_lying_down: 'Cuddling, lying down',
  hair_play: 'Hair play',
  back_rub_over_clothing: 'Back rub (over clothing)',
}

export const consentChecklistSchema = z.object({
  /** Each permitted contact area and its explicit yes/no/discuss choice. */
  contact: z.record(z.enum(CONSENT_CONTACT_AREAS), z.enum(CONSENT_TOUCH_OPTIONS)),
  conversationPreference: z.enum(['talk', 'quiet', 'mixed', 'no_preference']),
  clothingExpectation: z.string().max(280),
  personalSpaceNotes: z.string().max(280),
  otherRestrictions: z.string().max(280),
  /**
   * Explicit acknowledgement that consent can be withdrawn at any time.
   * Must be true for the checklist to be valid.
   */
  acknowledgeOngoingConsent: z.literal(true),
})

export type ConsentChecklist = z.infer<typeof consentChecklistSchema>

export interface BookingConsentRecord {
  bookingId: string
  /** Who completed this record: the client or the provider. */
  completedBy: 'client' | 'provider'
  checklist: ConsentChecklist
  completedAt: string
  /** Superseded when either party updates their checklist before the session. */
  supersededAt?: string | null
}

/**
 * Two checklists are mutually compatible when every contact area that one
 * party marks "yes" is not marked "no" by the other. "discuss_first" items
 * surface as items to confirm in person / by message before the session.
 */
export function consentCompatibility(
  a: ConsentChecklist,
  b: ConsentChecklist,
): { compatible: boolean; conflicts: ConsentContactArea[]; needsDiscussion: ConsentContactArea[] } {
  const conflicts: ConsentContactArea[] = []
  const needsDiscussion: ConsentContactArea[] = []
  const areas = new Set<ConsentContactArea>([
    ...(Object.keys(a.contact) as ConsentContactArea[]),
    ...(Object.keys(b.contact) as ConsentContactArea[]),
  ])
  for (const area of areas) {
    const va = a.contact[area] ?? 'discuss_first'
    const vb = b.contact[area] ?? 'discuss_first'
    if ((va === 'yes' && vb === 'no') || (va === 'no' && vb === 'yes')) {
      conflicts.push(area)
    } else if (va === 'discuss_first' || vb === 'discuss_first') {
      needsDiscussion.push(area)
    }
  }
  return { compatible: conflicts.length === 0, conflicts, needsDiscussion }
}
