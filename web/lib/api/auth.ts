import { getDb } from "@/lib/api/db"
import { mockMutation, mockRequest } from "@/lib/api/client"
import type { User } from "@/types"

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
}

export function apiGetCurrentUser(): Promise<User> {
  const [user] = getDb().users
  return mockRequest(user)
}

export function apiDeleteAccount(userId: string): Promise<void> {
  return mockMutation(() => {
    getDb().users = getDb().users.filter((entry) => entry.id !== userId)
  }, 500)
}

export function apiRegister(payload: RegisterPayload): Promise<User> {
  return mockMutation(() => {
    const existing = getDb().users.find(
      (user) => user.email.toLowerCase() === payload.email.toLowerCase()
    )
    if (existing) {
      throw new Error("An account with this email already exists.")
    }

    const user: User = {
      id: `usr_${Date.now()}`,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      role: "user",
      status: "active",
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    getDb().users.push(user)
    return user
  })
}

export function apiLogin(payload: LoginPayload): Promise<User> {
  return mockMutation(() => {
    const user = getDb().users.find(
      (entry) => entry.email.toLowerCase() === payload.email.toLowerCase()
    )
    if (!user) {
      throw new Error("Invalid email or password.")
    }
    if (user.status === "suspended") {
      throw new Error("This account has been suspended. Contact support.")
    }
    return user
  })
}