import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  apiCreateSavingsGoal,
  apiFundSavings,
  apiGetSavings,
  apiWithdrawSavings,
  type FundSavingsPayload,
  type WithdrawSavingsPayload,
} from "@/lib/api/savings"
import { savingsGrowth } from "@/lib/mock/savings"
import { queryKeys } from "@/hooks/queries/query-keys"

export function useSavings() {
  return useQuery({
    queryKey: queryKeys.savings.all,
    queryFn: apiGetSavings,
  })
}

export function useSavingsGrowth() {
  return useQuery({
    queryKey: queryKeys.savingsGrowth,
    queryFn: async () => savingsGrowth,
  })
}

export function useFundSavings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: FundSavingsPayload) => apiFundSavings(payload),
    onSuccess: () => {
      toast.success("Savings funded successfully.")
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsGrowth })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.recent })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useWithdrawSavings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: WithdrawSavingsPayload) =>
      apiWithdrawSavings(payload),
    onSuccess: () => {
      toast.success("Withdrawal request submitted.")
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.recent })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useCreateSavingsGoal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: { name: string; target: number; targetDate?: string }) =>
      apiCreateSavingsGoal(payload),
    onSuccess: () => {
      toast.success("Savings goal created successfully.")
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}