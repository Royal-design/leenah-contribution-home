import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  apiAdminAddContributionMember,
  apiAdminCompleteWithdrawal,
  apiAdminCreateContribution,
  apiAdminDeleteContribution,
  apiAdminDeleteTransaction,
  apiAdminGetContribution,
  apiAdminListContributions,
  apiAdminListTransactions,
  apiAdminListWithdrawals,
  apiAdminRemoveContributionMember,
  apiAdminUpdateContribution,
  apiBulkCreateUsers,
  apiDeleteUser,
  apiGetAdminRoles,
  apiGetAdminStats,
  apiGetAdminUser,
  apiGetAdminUsers,
  apiInviteUser,
  apiReviewWithdrawal,
  apiRevertTransaction,
  apiSendBroadcastMessage,
  apiSendDirectMessage,
  apiSetUserRole,
  apiSetUserRoles,
  apiSetUserStatus,
  type BulkUserEntry,
  type InviteUserPayload,
  type UserQuery,
} from "@/lib/api/admin"
import { queryKeys } from "@/hooks/queries/query-keys"
import { getErrorMessage } from "@/lib/api/types"
import type { UpdateContributionPayload } from "@/lib/api/contributions"
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

export function useSetUserRoles() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: Role[] }) =>
      apiSetUserRoles(userId, roles),
    onSuccess: (updated) => {
      toast.success("User roles updated.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.detail(updated.id) })
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
      endDate?: string
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

export function useAdminContribution(id: string) {
  return useQuery({
    queryKey: queryKeys.adminContributions.detail(id),
    queryFn: () => apiAdminGetContribution(id),
    enabled: !!id,
  })
}

export function useAdminUpdateContribution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateContributionPayload }) =>
      apiAdminUpdateContribution(id, payload),
    onSuccess: (updated) => {
      toast.success("Contribution updated.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminContributions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminContributions.detail(updated.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.contributions.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useAdminDeleteContribution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiAdminDeleteContribution(id),
    onSuccess: () => {
      toast.success("Contribution deleted.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminContributions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.contributions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useAdminAddContributionMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ contributionId, userId }: { contributionId: string; userId: string }) =>
      apiAdminAddContributionMember(contributionId, userId),
    onSuccess: (updated) => {
      toast.success("Member added.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminContributions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminContributions.detail(updated.id) })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useAdminRemoveContributionMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ contributionId, userId }: { contributionId: string; userId: string }) =>
      apiAdminRemoveContributionMember(contributionId, userId),
    onSuccess: (updated) => {
      toast.success("Member removed.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminContributions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminContributions.detail(updated.id) })
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

export function useAdminDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (transactionId: string) => apiAdminDeleteTransaction(transactionId),
    onSuccess: () => {
      toast.success("Transaction deleted.")
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

export function useAdminCompleteWithdrawal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (withdrawalId: string) => apiAdminCompleteWithdrawal(withdrawalId),
    onSuccess: () => {
      toast.success("Withdrawal marked as completed.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminWithdrawals.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useSendBroadcastMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      title: string
      message: string
      type?: "contribution" | "savings" | "withdrawal" | "system"
    }) => apiSendBroadcastMessage(payload),
    onSuccess: (result) => {
      toast.success(`Message sent to ${result.recipients} user${result.recipients === 1 ? "" : "s"}.`)
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useSendDirectMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      userId: string
      title: string
      message: string
      type?: "contribution" | "savings" | "withdrawal" | "system"
    }) => apiSendDirectMessage(payload),
    onSuccess: () => {
      toast.success("Message sent.")
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}