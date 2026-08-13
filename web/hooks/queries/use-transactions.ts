import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  apiGetRecentTransactions,
  apiGetTransactions,
  type TransactionQuery,
} from "@/lib/api/transactions"
import {
  apiGetNotifications,
  apiGetUnreadCount,
  apiMarkAllNotificationsRead,
  apiUpdateNotifications,
} from "@/lib/api/notifications"
import { queryKeys } from "@/hooks/queries/query-keys"
import { getErrorMessage } from "@/lib/api/types"

export function useTransactions(filters?: TransactionQuery) {
  return useQuery({
    queryKey: queryKeys.transactions.list(filters ?? {}),
    queryFn: () => apiGetTransactions(filters),
  })
}

export function useRecentTransactions(limit = 5) {
  return useQuery({
    queryKey: queryKeys.transactions.recent,
    queryFn: () => apiGetRecentTransactions(limit),
  })
}

export function useNotifications(params?: { page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: () => apiGetNotifications(params),
  })
}

export function useNotificationsUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: apiGetUnreadCount,
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => apiUpdateNotifications({ ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: apiMarkAllNotificationsRead,
    onSuccess: (marked) => {
      if (marked > 0) {
        toast.success(`${marked} notification${marked === 1 ? "" : "s"} marked as read.`)
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}