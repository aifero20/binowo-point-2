import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  id: string
  email?: string
}

interface UserProfile {
  id: string
  user_code: string
  full_name: string
  role_code: string
  is_admin: boolean
  is_supervisor: boolean
}

interface AuthStore {
  authUser: AuthUser | null
  profile: UserProfile | null
  isAuthenticated: boolean
  setAuthUser: (user: AuthUser | null) => void
  setProfile: (profile: UserProfile | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      authUser: null,
      profile: null,
      isAuthenticated: false,
      setAuthUser: (user) => set({ authUser: user, isAuthenticated: !!user }),
      setProfile: (profile) => set({ profile }),
      logout: () => set({ authUser: null, profile: null, isAuthenticated: false }),
    }),
    { name: 'binowo-auth' }
  )
)
