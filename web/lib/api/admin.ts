import { getDb } from "@/lib/api/db"
import { mockMutation, mockRequest } from "@/lib/api/client"
import type { AdminStats, Role, User, Withdrawal } from "@/types"
import { adminStats } from "@/lib/mock/dashboard"
import { iso } from "@/lib/mock/dates"

export function apiGetAdminStats(): Promise<AdminStats> {
  return mockRequest(adminStats)
}

export function apiGetAdminUsers(): Promise<User[]> {
  return mockRequest(getDb().users, 400)
}

export function apiSetUserStatus(
  userId: string,
  status: "active" | "suspended"
): Promise<void> {
  return mockMutation(() => {
    const user = getDb().users.find((entry) => entry.id === userId)
    if (user) {
      user.status = status
    }
  }, 400)
}

export function apiSetUserRole(userId: string, role: Role): Promise<void> {
  return mockMutation(() => {
    const user = getDb().users.find((entry) => entry.id === userId)
    if (user) {
      user.role = role
    }
  }, 400)
}

export function apiDeleteUser(userId: string): Promise<void> {
  return mockMutation(() => {
    getDb().users = getDb().users.filter((entry) => entry.id !== userId)
  }, 400)
}

export interface InviteUserPayload {
  firstName: string
  lastName: string
  email: string
  role: Role
}

export function apiInviteUser(payload: InviteUserPayload): Promise<User> {
  return mockMutation(() => {
    const existing = getDb().users.find(
      (user) => user.email.toLowerCase() === payload.email.toLowerCase()
    )
    if (existing) {
      throw new Error("A user with this email already exists.")
    }

    const user: User = {
      id: `usr_${Date.now()}`,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: "",
      role: payload.role,
      status: "invited",
      joinedAt: iso(new Date()),
      createdAt: iso(new Date()),
    }

    getDb().users.push(user)
    return user
  }, 600)
}

export interface BulkUserEntry {
  firstName: string
  lastName: string
  email: string
  role?: Role
}

export function apiBulkCreateUsers(entries: BulkUserEntry[]): Promise<User[]> {
  return mockMutation(() => {
    const created: User[] = []

    for (const entry of entries) {
      const existing = getDb().users.some(
        (user) => user.email.toLowerCase() === entry.email.toLowerCase()
      )
      if (existing) {
        continue
      }

      const user: User = {
        id: `usr_${Date.now()}_${created.length}`,
        firstName: entry.firstName,
        lastName: entry.lastName,
        email: entry.email,
        phone: "",
        role: entry.role ?? "user",
        status: "invited",
        joinedAt: iso(new Date()),
        createdAt: iso(new Date()),
      }

      getDb().users.push(user)
      created.push(user)
    }

    return created
  }, 700)
}

export function apiRevertTransaction(transactionId: string): Promise<void> {
  return mockMutation(() => {
    const transaction = getDb().transactions.find(
      (entry) => entry.id === transactionId
    )
    if (transaction) {
      transaction.status = "reverted"
    }
  }, 400)
}

export function apiGetAdminWithdrawals(): Promise<Withdrawal[]> {
  return mockRequest(getDb().withdrawals, 400)
}

export function apiReviewWithdrawal(
  withdrawalId: string,
  status: "approved" | "rejected"
): Promise<void> {
  return mockMutation(() => {
    const withdrawal = getDb().withdrawals.find(
      (entry) => entry.id === withdrawalId
    )
    if (withdrawal) {
      withdrawal.status = status
    }
  }, 400)
}