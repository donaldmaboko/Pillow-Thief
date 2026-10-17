import { create } from 'zustand'
import type { Profile, UserRole } from '@pillow-thief/shared'

interface SessionState {
  userId: string | null
  profile: Profile | null
  /** Current role, derived from the profile. Null before the profile loads. */
  role: UserRole | null
  isProvider: boolean
  isAdmin: boolean
  hydrated: boolean
  setSession: (userId: string | null, profile: Profile | null) => void
  setHydrated: () => void
  signOut: () => void
}

export const useSession = create<SessionState>((set) => ({
  userId: null,
  profile: null,
  role: null,
  isProvider: false,
  isAdmin: false,
  hydrated: false,
  setSession: (userId, profile) => {
    const role = (profile?.role as UserRole | undefined) ?? null
    set({
      userId,
      profile,
      role,
      isProvider: role === 'provider',
      isAdmin: role === 'admin',
    })
  },
  setHydrated: () => set({ hydrated: true }),
  signOut: () =>
    set({ userId: null, profile: null, role: null, isProvider: false, isAdmin: false }),
}))
