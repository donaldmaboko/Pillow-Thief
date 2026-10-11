-- Pillow Thief :: shared enums
-- Mirrors packages/shared/src/types.ts — keep in sync.

create type public.user_role as enum ('client', 'provider', 'admin');

create type public.verification_state as enum
  ('unverified', 'pending', 'verified', 'rejected', 'suspended');

create type public.meeting_arrangement as enum
  ('provider_travels', 'client_visits', 'public_meeting');

create type public.booking_status as enum (
  'draft',
  'pending_payment',
  'pending_approval',
  'confirmed',
  'in_progress',
  'completed',
  'declined',
  'cancelled',
  'expired',
  'disputed'
);

create type public.payment_status as enum
  ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded', 'voided');

create type public.payment_provider as enum ('sandbox', 'gateway');

create type public.refund_status as enum ('pending', 'processing', 'succeeded', 'failed');

create type public.payout_status as enum ('pending', 'processing', 'paid', 'failed');

create type public.report_category as enum (
  'sexual_solicitation',
  'harassment',
  'safety',
  'fraud',
  'identity',
  'unauthorised_recording',
  'privacy_breach',
  'other'
);

create type public.report_status as enum ('open', 'investigating', 'resolved', 'dismissed');

create type public.dispute_status as enum ('open', 'investigating', 'resolved');

create type public.ticket_status as enum ('open', 'pending_user', 'resolved', 'closed');

create type public.consent_conversation_pref as enum ('talk', 'quiet', 'mixed', 'no_preference');

-- Language tags used across profiles and provider applications.
create type public.language_tag as enum ('en', 'tn', 'af', 'zu', 'fr', 'pt', 'other');
