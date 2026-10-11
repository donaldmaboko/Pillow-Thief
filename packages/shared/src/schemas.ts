/**
 * Zod schemas — single source of truth for input validation.
 * Used by the mobile app (react-hook-form resolvers) and by Edge Functions
 * (server-side re-validation of every request body).
 */

import { z } from 'zod'
import { MEETING_ARRANGEMENTS, SESSION_DURATIONS_MIN, SUPPORTED_LANGUAGES } from './types'

const minorUnits = z.number().int().min(0, 'Amount cannot be negative')

export const registrationSchema = z
  .object({
    displayName: z.string().min(2, 'Display name is too short').max(40),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    confirmPassword: z.string(),
    isOver18: z.literal(true, {
      errorMap: () => ({ message: 'You must confirm you are 18 or older to use Pillow Thief.' }),
    }),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms of Service.' }) }),
    acceptPrivacy: z.literal(true, { errorMap: () => ({ message: 'You must accept the Privacy Policy.' }) }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
export type RegistrationInput = z.infer<typeof registrationSchema>

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const providerApplicationSchema = z.object({
  legalName: z.string().min(3, 'Enter your legal name').max(80),
  displayName: z.string().min(2).max(40),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date'),
  bio: z.string().min(40, 'Tell clients a little more about you (at least 40 characters)').max(1000),
  languages: z.array(z.enum(SUPPORTED_LANGUAGES)).min(1, 'Select at least one language'),
  city: z.string().min(2).max(60),
  neighbourhood: z.string().max(60).optional().or(z.literal('')),
  meetingArrangements: z.array(z.enum(MEETING_ARRANGEMENTS)).min(1, 'Select at least one meeting option'),
  basePrice60: minorUnits,
  boundaries: z.string().min(20, 'Describe your boundaries (at least 20 characters)').max(1000),
})
export type ProviderApplicationInput = z.infer<typeof providerApplicationSchema>

export const serviceSchema = z.object({
  title: z.string().min(3).max(60),
  description: z.string().min(20).max(600),
  price60: minorUnits.min(1, 'Set a price for 60 minutes'),
  price30: minorUnits.optional().nullable(),
  price90: minorUnits.optional().nullable(),
  price120: minorUnits.optional().nullable(),
})
export type ServiceInput = z.infer<typeof serviceSchema>

export const availabilityWindowSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinutes: z.number().int().min(0).max(1439),
    endMinutes: z.number().int().min(1).max(1440),
  })
  .refine((v) => v.endMinutes > v.startMinutes + 14, {
    message: 'Availability windows must be at least 15 minutes long',
  })

export const bookingRequestSchema = z.object({
  provider_id: z.string().uuid(),
  service_id: z.string().uuid(),
  duration_min: z.number().refine((v) => (SESSION_DURATIONS_MIN as readonly number[]).includes(v), {
    message: 'Choose a supported session duration',
  }),
  /** ISO-8601 UTC timestamp. Displayed to users in Africa/Gaborone. */
  starts_at: z.string().datetime(),
  meeting_arrangement: z.enum(MEETING_ARRANGEMENTS),
  /** For provider_travels: validated server-side against provider zones. */
  client_place_id: z.string().max(200).optional(),
  client_address_label: z.string().max(160).optional(),
  client_lat: z.number().min(-90).max(90).optional(),
  client_lng: z.number().min(-180).max(180).optional(),
  /** For client_visits / public_meeting. */
  service_location_id: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
})
export type BookingRequestInput = z.infer<typeof bookingRequestSchema>

export const reviewSchema = z.object({
  booking_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  professionalism: z.number().int().min(1).max(5),
  punctuality: z.number().int().min(1).max(5),
  communication: z.number().int().min(1).max(5),
  respect_for_boundaries: z.number().int().min(1).max(5),
  accuracy: z.number().int().min(1).max(5),
  body: z.string().max(1500).optional(),
})
export type ReviewInput = z.infer<typeof reviewSchema>

export const reportSchema = z.object({
  target_user_id: z.string().uuid().optional(),
  booking_id: z.string().uuid().optional(),
  category: z.enum([
    'sexual_solicitation',
    'harassment',
    'safety',
    'fraud',
    'identity',
    'unauthorised_recording',
    'privacy_breach',
    'other',
  ]),
  description: z.string().min(10, 'Please describe what happened (at least 10 characters)').max(2000),
})
export type ReportInput = z.infer<typeof reportSchema>

export const messageSchema = z.object({
  body: z.string().min(1).max(2000),
})
export type MessageInput = z.infer<typeof messageSchema>

export const SUPPORT_TICKET_CATEGORIES = ['booking', 'payment', 'safety', 'account', 'other'] as const
export const supportTicketSchema = z.object({
  category: z.enum(SUPPORT_TICKET_CATEGORIES),
  subject: z.string().min(3).max(120),
  body: z.string().min(10).max(4000),
  booking_id: z.string().uuid().optional(),
})
export type SupportTicketInput = z.infer<typeof supportTicketSchema>
