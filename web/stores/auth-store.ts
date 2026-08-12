"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { User } from "@/types"
import { apiLogin, apiRegister, type RegisterPayload } from "@/lib/api/auth"

interface AuthState {
  user: User | null
  status: "idle" | "authenticated" | "unauthenticated"
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  setUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      status: "idle",
      loading: false,
      login: async (email, password) => {
        set({ loading: true })
        try {
          const user = await apiLogin({ email, password })
          set({ user, status: "authenticated", loading: false })
          return user
        } catch (error) {
          set({ loading: false })
          throw error
        }
      },
      register: async (payload) => {
        set({ loading: true })
        try {
          const user = await apiRegister(payload)
          set({ user, status: "authenticated", loading: false })
          return user
        } catch (error) {
          set({ loading: false })
          throw error
        }
      },
      setUser: (user) =>
        set({
          user,
          status: user ? "authenticated" : "unauthenticated",
        }),
      logout: () => set({ user: null, status: "unauthenticated", loading: false }),
    }),
    {
      name: "lch-auth",
      partialize: (state) => ({ user: state.user, status: state.status }),
    }
  )
)