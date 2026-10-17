import { can as canCapability, type RoleCapability } from '@pillow-thief/shared'
import { useSession } from '../../stores/session'

/**
 * Reactive capability checks. These read the same map the database policies
 * enforce, so a screen only ever offers something the server will allow.
 */
export function useCan(capability: RoleCapability): boolean {
  const role = useSession((s) => s.role)
  return canCapability(role, capability)
}

export function useCanAny(capabilities: readonly RoleCapability[]): boolean {
  const role = useSession((s) => s.role)
  return capabilities.some((c) => canCapability(role, c))
}

export function useRole() {
  return useSession((s) => s.role)
}
