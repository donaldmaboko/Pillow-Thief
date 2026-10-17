import { RoleHomeRedirect } from '../src/features/roles/RoleGate'

/**
 * Entry point. Sends each role to its own home surface:
 *   admin    -> the admin console
 *   provider -> the provider studio
 *   client   -> the swipe deck
 */
export default function Index() {
  return <RoleHomeRedirect />
}
