import { describe, expect, it } from 'vitest'
import { consentChecklistSchema, consentCompatibility, type ConsentChecklist } from '../src/consent'

const base: ConsentChecklist = {
  contact: { hugging: 'yes', hand_holding: 'yes' },
  conversationPreference: 'mixed',
  clothingExpectation: 'Comfortable casual clothing.',
  personalSpaceNotes: '',
  otherRestrictions: '',
  acknowledgeOngoingConsent: true,
}

describe('consent', () => {
  it('requires acknowledgement that consent is ongoing', () => {
    const parsed = consentChecklistSchema.safeParse({ ...base, acknowledgeOngoingConsent: false })
    expect(parsed.success).toBe(false)
  })

  it('detects compatible checklists', () => {
    const other: ConsentChecklist = { ...base, contact: { hugging: 'yes', hand_holding: 'discuss_first' } }
    const r = consentCompatibility(base, other)
    expect(r.compatible).toBe(true)
    expect(r.needsDiscussion).toContain('hand_holding')
  })

  it('detects conflicts when one party declines what the other wants', () => {
    const other: ConsentChecklist = { ...base, contact: { hugging: 'no' } }
    const r = consentCompatibility(base, other)
    expect(r.compatible).toBe(false)
    expect(r.conflicts).toContain('hugging')
  })
})
