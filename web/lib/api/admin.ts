import { getDb } from "@/lib/api/db"
import { mockMutation, mockRequest } from "@/lib/api/client"
import type { AdminStats, User, Withdrawal } from "@/types"
import { adminStats } from "@/lib/mock/dashboard"

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