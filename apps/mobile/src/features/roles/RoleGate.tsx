import React from 'react'
import { Redirect } from 'expo-router'
import { can, ROLE_HOME, type RoleCapability } from '@pillow-thief/shared'
import { useSession } from '../../stores/session'

/**
 * Route guard. Wraps a screen or a layout and redirects anyone whose role lacks
 * the capability. This is convenience only — the database refuses the same
 * action independently (RLS + is_admin()-gated RPCs).
 */
export function RoleGate({ capability, children }: { capability: RoleCapability; children: React.ReactNode }) {
  const userId = useSession((s) => s.userId)
  const profile = useSession((s) => s.profile)

  if (!userId) return <Redirect href="/(auth)/welcome" />
  // The root layout hydrates the profile before rendering; a null profile here
  // means the fetch failed, so fall back to the least-privileged surface.
  if (!can(profile?.role ?? 'client', capability)) return <Redirect href="/" />
  return <>{children}</>
}

/** Sends the signed-in user to the home surface for their role. */
export function RoleHomeRedirect() {
  const userId = useSession((s) => s.userId)
  const profile = useSession((s) => s.profile)

  if (!userId) return <Redirect href="/(auth)/welcome" />
  const role = profile?.role ?? 'client'
  return <Redirect href={ROLE_HOME[role] as never} />
}
