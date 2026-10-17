import type { UserRole } from './types'

/**
 * Role capability map — the single source of truth for what each role may do.
 *
 * Consumed by:
 *   * the mobile tab bar (which tabs to compose)
 *   * the route guards (`(provider)`, `(admin)`)
 *   * the role matrix test suite
 *
 * Hiding a screen is never the security control — the database RLS policies and
 * the `is_admin()`-gated RPCs are. This map keeps the UI honest about what the
 * database will already refuse.
 */
export const ROLE_CAPABILITY_NAMES = [
  'discover.swipe',
  'discover.search',
  'discover.map',
  'matches.view',
  'book.create',
  'book.receive',
  'provider.apply',
  'provider.studio',
  'chat.participate',
  'safety.report',
  'admin.console',
  'admin.verify_provider',
  'admin.moderate',
  'admin.platform_settings',
] as const

export type RoleCapability = (typeof ROLE_CAPABILITY_NAMES)[number]

export const ROLE_CAPABILITIES: Record<UserRole, readonly RoleCapability[]> = {
  // A client discovers, books and pays.
  client: [
    'discover.swipe',
    'discover.search',
    'discover.map',
    'matches.view',
    'book.create',
    'provider.apply',
    'chat.participate',
    'safety.report',
  ],
  // A provider receives bookings and runs the studio. Providers can also browse
  // and swipe, so they can match with the clients who liked them.
  provider: [
    'discover.swipe',
    'discover.search',
    'discover.map',
    'matches.view',
    'book.receive',
    'provider.studio',
    'chat.participate',
    'safety.report',
  ],
  // An admin runs the platform. Admins keep the discovery surfaces so they can
  // see exactly what a client sees while moderating.
  admin: [
    'discover.swipe',
    'discover.search',
    'discover.map',
    'matches.view',
    'chat.participate',
    'safety.report',
    'admin.console',
    'admin.verify_provider',
    'admin.moderate',
    'admin.platform_settings',
  ],
}

export function can(role: UserRole | null | undefined, capability: RoleCapability): boolean {
  if (!role) return false
  return ROLE_CAPABILITIES[role].includes(capability)
}

/** True when the role has at least one of the given capabilities. */
export function canAny(role: UserRole | null | undefined, capabilities: readonly RoleCapability[]): boolean {
  return capabilities.some((c) => can(role, c))
}

export const ROLE_LABELS: Record<UserRole, string> = {
  client: 'Client',
  provider: 'Provider',
  admin: 'Administrator',
}

/** Landing route per role. Kept as a plain map so the router stays declarative. */
export const ROLE_HOME: Record<UserRole, string> = {
  client: '/(app)/(tabs)/deck',
  provider: '/(provider)/dashboard',
  admin: '/admin',
}

/** Tabs composed from capabilities, in display order. */
export const TAB_CAPABILITY: Record<string, RoleCapability> = {
  home: 'discover.search',
  deck: 'discover.swipe',
  explore: 'discover.search',
  map: 'discover.map',
  bookings: 'book.create',
  profile: 'safety.report',
}
