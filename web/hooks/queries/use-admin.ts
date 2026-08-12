import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import {
  apiBulkCreateUsers,
  apiDeleteUser,
  apiGetAdminStats,
  apiGetAdminUsers,
  apiGetAdminWithdrawals,
  apiInviteUser,
  apiRevertTransaction,
  apiReviewWithdrawal,
  apiSetUserRole,
  apiSetUserStatus,
  type BulkUserEntry,
  type InviteUserPayload,
} from "@/lib/api/admin"
import { queryKeys } from "@/hooks/queries/query-keys"
import { toast } from "sonner"
import type { Role } from "@/types"

export function useAdminStats() {
  return useQuery({
    queryKey: queryKeys.adminStats,
    queryFn: apiGetAdminStats,
  })
}

export function useAdminUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: apiGetAdminUsers,
  })
}

export function useSetUserStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "active" | "suspended" }) =>
      apiSetUserStatus(userId, status),
    onSuccess: () => {
      toast.success("User status updated.")
      queryClient.invalidateQueries({ queryKey: queryKeys.users })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useSetUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      apiSetUserRole(userId, role),
    onSuccess: () => {
      toast.success("User role updated.")
      queryClient.invalidateQueries({ queryKey: queryKeys.users })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => apiDeleteUser(userId),
    onSuccess: () => {
      toast.success("User deleted.")
      queryClient.invalidateQueries({ queryKey: queryKeys.users })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useInviteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: InviteUserPayload) => apiInviteUser(payload),
    onSuccess: () => {
      toast.success("Invitation sent.")
      queryClient.invalidateQueries({ queryKey: queryKeys.users })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
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
      queryClient.invalidateQueries({ queryKey: queryKeys.users })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useRevertTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (transactionId: string) => apiRevertTransaction(transactionId),
    onSuccess: () => {
      toast.success("Transaction reverted.")
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useAdminWithdrawals() {
  return useQuery({
    queryKey: queryKeys.withdrawals,
    queryFn: apiGetAdminWithdrawals,
  })
}

export function useReviewWithdrawal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ withdrawalId, status }: { withdrawalId: string; status: "approved" | "rejected" }) =>
      apiReviewWithdrawal(withdrawalId, status),
    onSuccess: () => {
      toast.success("Withdrawal reviewed.")
      queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}