import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  apiGetNotifications,
  apiGetRecentTransactions,
  apiGetTransactions,
  apiUpdateNotifications,
  type TransactionFilters,
} from "@/lib/api/transactions"
import { queryKeys } from "@/hooks/queries/query-keys"

export function useTransactions(filters?: TransactionFilters) {
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

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: apiGetNotifications,
  })
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) => apiUpdateNotifications({ ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}