import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import {
  apiGetAdminStats,
  apiGetAdminUsers,
  apiGetAdminWithdrawals,
  apiReviewWithdrawal,
  apiSetUserStatus,
} from "@/lib/api/admin"
import { queryKeys } from "@/hooks/queries/query-keys"
import { toast } from "sonner"

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