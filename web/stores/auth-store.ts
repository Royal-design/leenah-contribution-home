"use client"

import { create } from "zustand"
import type { User } from "@/types"
import {
  apiDeleteAccount,
  apiGoogleLogin,
  apiLogin,
  apiLogout,
  apiRegister,
  type RegisterPayload,
} from "@/lib/api/auth"
import {
  clearStoredSession,
  getStoredSession,
  setStoredSession,
  updateStoredUser,
} from "@/lib/api/session"

interface AuthState {
  user: User | null
  status: "idle" | "authenticated" | "unauthenticated"
  loading: boolean
  hydrate: () => Promise<void>
  login: (email: string, password: string) => Promise<User>
  googleLogin: (accessToken: string) => Promise<User>
  register: (payload: RegisterPayload) => Promise<User>
  setUser: (user: User | null) => void
  deleteAccount: () => Promise<void>
  logout: () => Promise<void>
  expireSession: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  status: "idle",
  loading: false,
  hydrate: async () => {
    const session = getStoredSession()
    if (session && session.accessToken) {
      set({ user: session.user, status: "authenticated", loading: false })
    } else {
      set({ user: null, status: "unauthenticated", loading: false })
    }
  },
  login: async (email, password) => {
    set({ loading: true })
    try {
      const result = await apiLogin({ email, password })
      setStoredSession(result)
      set({ user: result.user, status: "authenticated", loading: false })
      return result.user
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
  register: async (payload) => {
    set({ loading: true })
    try {
      const result = await apiRegister(payload)
      setStoredSession(result)
      set({ user: result.user, status: "authenticated", loading: false })
      return result.user
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
  googleLogin: async (accessToken) => {
    set({ loading: true })
    try {
      const result = await apiGoogleLogin(accessToken)
      setStoredSession(result)
      set({ user: result.user, status: "authenticated", loading: false })
      return result.user
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
  setUser: (user) => {
    if (user) {
      updateStoredUser(user)
      set({ user, status: "authenticated" })
    } else {
      clearStoredSession()
      set({ user: null, status: "unauthenticated" })
    }
  },
  deleteAccount: async () => {
    await apiDeleteAccount()
    clearStoredSession()
    set({ user: null, status: "unauthenticated", loading: false })
  },
  logout: async () => {
    const refreshToken = getStoredSession()?.refreshToken
    if (refreshToken) {
      try {
        await apiLogout(refreshToken)
      } catch {
        // best-effort server revoke — clear locally regardless
      }
    }
    clearStoredSession()
    set({ user: null, status: "unauthenticated", loading: false })
  },
  expireSession: () => {
    clearStoredSession()
    set({ user: null, status: "unauthenticated", loading: false })
  },
}))