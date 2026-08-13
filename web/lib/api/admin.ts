import { api } from "@/lib/api/http"
import {
  mapAdminStats,
  mapContribution,
  mapTransaction,
  mapUser,
  mapWithdrawal,
  type RawAdminStats,
  type RawContribution,
  type RawRoleSummary,
  type RawTransaction,
  type RawUser,
  type RawWithdrawal,
} from "@/lib/api/mappers"
import { toPaginated, type ListPayload, type Paginated } from "@/lib/api/types"
import type {
  AdminStats,
  Contribution,
  Role,
  Transaction,
  TransactionStatus,
  TransactionType,
  User,
  UserStatus,
  Withdrawal,
} from "@/types"

export interface UserQuery {
  page?: number
  pageSize?: number
  search?: string
  role?: Role
  status?: UserStatus
}

export interface InviteUserPayload {
  firstName: string
  lastName: string
  email: string
  role: Role
}

export interface BulkUserEntry {
  firstName: string
  lastName: string
  email: string
  role?: Role
}

export interface AdminUserDetail {
  user: User
  contributionCount: number
  savingsBalance: number
  transactions: Transaction[]
}

export async function apiGetAdminStats(): Promise<AdminStats> {
  const { data } = await api.get<RawAdminStats>("/api/admin/stats")
  return mapAdminStats(data)
}

export async function apiGetAdminOverview(): Promise<{
  stats: AdminStats
  recentTransactions: Transaction[]
}> {
  const { data } = await api.get<{
    stats: RawAdminStats
    recent_transactions: RawTransaction[]
  }>("/api/admin/overview")
  return {
    stats: mapAdminStats(data.stats),
    recentTransactions: data.recent_transactions.map(mapTransaction),
  }
}

export async function apiGetAdminUsers(
  params?: UserQuery
): Promise<Paginated<User>> {
  const pageSize = params?.pageSize ?? 20
  const { data } = await api.get<ListPayload<RawUser>>("/api/admin/users", {
    page: params?.page,
    page_size: pageSize,
    search: params?.search,
    role: params?.role,
    status: params?.status,
  })
  return toPaginated(data.items.map(mapUser), data, pageSize)
}

export async function apiGetAdminUser(id: string): Promise<AdminUserDetail> {
  const { data } = await api.get<{
    user: RawUser
    contribution_count: number
    savings_balance: number
    transactions: RawTransaction[]
  }>(`/api/admin/users/${id}`)
  return {
    user: mapUser(data.user),
    contributionCount: data.contribution_count,
    savingsBalance: data.savings_balance,
    transactions: data.transactions.map(mapTransaction),
  }
}

export async function apiInviteUser(payload: InviteUserPayload): Promise<User> {
  const { data } = await api.post<RawUser>("/api/admin/users/invite", {
    first_name: payload.firstName,
    last_name: payload.lastName,
    email: payload.email,
    role: payload.role,
  })
  return mapUser(data)
}

export async function apiBulkCreateUsers(
  entries: BulkUserEntry[]
): Promise<User[]> {
  const { data } = await api.post<RawUser[]>("/api/admin/users/bulk", {
    users: entries.map((entry) => ({
      first_name: entry.firstName,
      last_name: entry.lastName,
      email: entry.email,
      role: entry.role ?? "user",
    })),
  })
  return data.map(mapUser)
}

export async function apiGetAdminRoles(): Promise<RawRoleSummary[]> {
  const { data } = await api.get<RawRoleSummary[]>("/api/admin/roles")
  return data
}

export async function apiSetUserRole(userId: string, role: Role): Promise<User> {
  const { data } = await api.patch<RawUser>(`/api/admin/users/${userId}/role`, { role })
  return mapUser(data)
}

export async function apiSetUserStatus(userId: string, status: UserStatus): Promise<User> {
  const { data } = await api.patch<RawUser>(`/api/admin/users/${userId}/status`, { status })
  return mapUser(data)
}

export async function apiDeleteUser(userId: string): Promise<void> {
  await api.delete(`/api/admin/users/${userId}`)
}

export async function apiAdminCreateContribution(payload: {
  name: string
  description?: string
  amount: number
  frequency: "weekly" | "biweekly" | "monthly" | "custom"
  memberCount: number
  rounds?: number
  startDate: string
  withdrawalDate?: string
}): Promise<Contribution> {
  const { data } = await api.post<RawContribution>("/api/admin/contributions", {
    name: payload.name,
    description: payload.description,
    amount: payload.amount,
    frequency: payload.frequency,
    member_count: payload.memberCount,
    rounds: payload.rounds ?? 12,
    start_date: payload.startDate,
    withdrawal_rule: payload.withdrawalDate ? "fixed_date" : undefined,
    fixed_withdrawal_date: payload.withdrawalDate,
  })
  return mapContribution(data)
}

export async function apiAdminListContributions(params?: {
  page?: number
  pageSize?: number
  search?: string
}): Promise<Paginated<Contribution>> {
  const pageSize = params?.pageSize ?? 20
  const { data } = await api.get<ListPayload<RawContribution>>("/api/admin/contributions", {
    page: params?.page,
    page_size: pageSize,
    search: params?.search,
  })
  return toPaginated(data.items.map(mapContribution), data, pageSize)
}

export async function apiAdminListTransactions(params?: {
  page?: number
  pageSize?: number
  type?: TransactionType
  status?: TransactionStatus
}): Promise<Paginated<Transaction>> {
  const pageSize = params?.pageSize ?? 20
  const { data } = await api.get<ListPayload<RawTransaction>>("/api/admin/transactions", {
    page: params?.page,
    page_size: pageSize,
    type: params?.type,
    status: params?.status,
  })
  return toPaginated(data.items.map(mapTransaction), data, pageSize)
}

export async function apiRevertTransaction(transactionId: string): Promise<Transaction> {
  const { data } = await api.post<RawTransaction>(
    `/api/admin/transactions/${transactionId}/revert`
  )
  return mapTransaction(data)
}

export async function apiAdminListWithdrawals(params?: {
  page?: number
  pageSize?: number
  status?: "pending" | "approved" | "rejected" | "completed"
}): Promise<Paginated<Withdrawal>> {
  const pageSize = params?.pageSize ?? 20
  const { data } = await api.get<ListPayload<RawWithdrawal>>("/api/admin/withdrawals", {
    page: params?.page,
    page_size: pageSize,
    status: params?.status,
  })
  return toPaginated(data.items.map(mapWithdrawal), data, pageSize)
}

export async function apiReviewWithdrawal(
  withdrawalId: string,
  status: "approved" | "rejected"
): Promise<Withdrawal> {
  const { data } = await api.patch<RawWithdrawal>(
    `/api/admin/withdrawals/${withdrawalId}/review`,
    { status }
  )
  return mapWithdrawal(data)
}