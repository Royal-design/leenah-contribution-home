import type { User } from "@/types"

const SESSION_KEY = "lch.session"

export interface StoredSession {
  user: User
  accessToken: string
  refreshToken: string
}

export function getStoredSession(): StoredSession | null {
  if (typeof window === "undefined") {
    return null
  }
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) {
      return null
    }
    const session = JSON.parse(raw) as StoredSession
    return session
  } catch {
    window.localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function getStoredTokens(): {
  accessToken?: string
  refreshToken?: string
} {
  const session = getStoredSession()
  return {
    accessToken: session?.accessToken,
    refreshToken: session?.refreshToken,
  }
}

export function setStoredSession(session: StoredSession): void {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function updateStoredUser(user: User): void {
  if (typeof window === "undefined") {
    return
  }
  const session = getStoredSession()
  if (session) {
    setStoredSession({ ...session, user })
  }
}

export function updateStoredTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === "undefined") {
    return
  }
  const session = getStoredSession()
  if (session) {
    setStoredSession({ ...session, accessToken, refreshToken })
  }
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.removeItem(SESSION_KEY)
}