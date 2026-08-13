import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  apiAdminCreateContribution,
  apiAdminListContributions,
  apiAdminListTransactions,
  apiAdminListWithdrawals,
  apiBulkCreateUsers,
  apiDeleteUser,
  apiGetAdminRoles,
  apiGetAdminStats,
  apiGetAdminUser,
  apiGetAdminUsers,
  apiInviteUser,
  apiReviewWithdrawal,
  apiRevertTransaction,
  apiSetUserRole,
  apiSetUserStatus,
  type BulkUserEntry,
  type InviteUserPayload,
  type UserQuery,
} from "@/lib/api/admin"
import { queryKeys } from "@/hooks/queries/query-keys"
import { getErrorMessage } from "@/lib/api/types"
import type { Role, TransactionStatus, TransactionType } from "@/types"

export function useAdminStats() {
  return useQuery({ queryKey: queryKeys.adminStats, queryFn: apiGetAdminStats })
}

export function useAdminUsers(params?: UserQuery) {
  return useQuery({
    queryKey: queryKeys.adminUsers.list(params ?? {}),
    queryFn: () => apiGetAdminUsers(params),
  })
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: queryKeys.adminUsers.detail(id),
    queryFn: () => apiGetAdminUser(id),
    enabled: !!id,
  })
}

export function useAdminRoles() {
  return useQuery({
    queryKey: queryKeys.adminRoles,
    queryFn: apiGetAdminRoles,
  })
}

export function useSetUserStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "active" | "suspended" }) =>
      apiSetUserStatus(userId, status),
    onSuccess: () => {
      toast.success("User status updated.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useSetUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      apiSetUserRole(userId, role),
    onSuccess: () => {
      toast.success("User role updated.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => apiDeleteUser(userId),
    onSuccess: () => {
      toast.success("User deleted.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useInviteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: InviteUserPayload) => apiInviteUser(payload),
    onSuccess: () => {
      toast.success("Invitation sent.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useBulkCreateUsers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entries: BulkUserEntry[]) => apiBulkCreateUsers(entries),
    onSuccess: (created) => {
      toast.success(
        created.length > 0
          ? `${created.length} user${created.length === 1 ? "" : "s"} created.`
          : "No new users added."
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useAdminContributions(params?: {
  page?: number
  pageSize?: number
  search?: string
}) {
  return useQuery({
    queryKey: queryKeys.adminContributions.list(params ?? {}),
    queryFn: () => apiAdminListContributions(params),
  })
}

export function useAdminCreateContribution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      name: string
      description?: string
      amount: number
      frequency: "weekly" | "biweekly" | "monthly" | "custom"
      memberCount: number
      rounds?: number
      startDate: string
      withdrawalDate?: string
    }) => apiAdminCreateContribution(payload),
    onSuccess: () => {
      toast.success("Contribution plan created.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminContributions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.contributions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useAdminTransactions(params?: {
  page?: number
  pageSize?: number
  type?: TransactionType
  status?: TransactionStatus
}) {
  return useQuery({
    queryKey: queryKeys.adminTransactions.list(params ?? {}),
    queryFn: () => apiAdminListTransactions(params),
  })
}

export function useRevertTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (transactionId: string) => apiRevertTransaction(transactionId),
    onSuccess: () => {
      toast.success("Transaction reverted.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminTransactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useAdminWithdrawals(params?: {
  page?: number
  pageSize?: number
  status?: "pending" | "approved" | "rejected" | "completed"
}) {
  return useQuery({
    queryKey: queryKeys.adminWithdrawals.list(params ?? {}),
    queryFn: () => apiAdminListWithdrawals(params),
  })
}

export function useReviewWithdrawal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ withdrawalId, status }: { withdrawalId: string; status: "approved" | "rejected" }) =>
      apiReviewWithdrawal(withdrawalId, status),
    onSuccess: () => {
      toast.success("Withdrawal reviewed.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminWithdrawals.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}