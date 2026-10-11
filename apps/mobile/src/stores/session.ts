import { create } from 'zustand'
import type { Profile, UserRole } from '@pillow-thief/shared'

interface SessionState {
  userId: string | null
  profile: Profile | null
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
  isProvider: false,
  isAdmin: false,
  hydrated: false,
  setSession: (userId, profile) =>
    set({
      userId,
      profile,
      isProvider: (profile?.role as UserRole | undefined) === 'provider',
      isAdmin: (profile?.role as UserRole | undefined) === 'admin',
    }),
  setHydrated: () => set({ hydrated: true }),
  signOut: () => set({ userId: null, profile: null, isProvider: false, isAdmin: false }),
}))
