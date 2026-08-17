import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  apiCreateSavingsGoal,
  apiDeleteSavingsGoal,
  apiFundSavings,
  apiGetSavings,
  apiUpdateSavingsGoal,
  apiWithdrawSavings,
  type FundSavingsPayload,
  type UpdateSavingsGoalPayload,
  type WithdrawSavingsPayload,
} from "@/lib/api/savings"
import { apiGetRecentTransactions } from "@/lib/api/transactions"
import { queryKeys } from "@/hooks/queries/query-keys"
import { getErrorMessage } from "@/lib/api/types"

export function useSavings() {
  return useQuery({ queryKey: queryKeys.savings.all, queryFn: apiGetSavings })
}

async function buildSavingsGrowth() {
  const account = await apiGetSavings()
  const transactions = await apiGetRecentTransactions(50)
  const byMonth = new Map<string, number>()

  for (const txn of transactions) {
    if (txn.type !== "savings" && txn.type !== "funding") {
      continue
    }
    const month = new Date(txn.date).toLocaleString("en-NG", { month: "short" })
    byMonth.set(month, (byMonth.get(month) ?? 0) + txn.amount)
  }

  if (byMonth.size === 0) {
    const now = new Date().toLocaleString("en-NG", { month: "short" })
    return [{ month: now, amount: account.totalSaved }]
  }

  return Array.from(byMonth.entries()).map(([month, amount]) => ({ month, amount }))
}

export function useSavingsGrowth() {
  return useQuery({
    queryKey: queryKeys.savingsGrowth,
    queryFn: buildSavingsGrowth,
  })
}

export function useFundSavings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: FundSavingsPayload) => apiFundSavings(payload),
    onSuccess: () => {
      toast.success("Savings funded successfully.")
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsGrowth })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.recent })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useWithdrawSavings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: WithdrawSavingsPayload) => apiWithdrawSavings(payload),
    onSuccess: () => {
      toast.success("Withdrawal request submitted.")
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.recent })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
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
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateSavingsGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSavingsGoalPayload }) =>
      apiUpdateSavingsGoal(id, payload),
    onSuccess: () => {
      toast.success("Savings goal updated.")
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useDeleteSavingsGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDeleteSavingsGoal(id),
    onSuccess: () => {
      toast.success("Savings goal deleted.")
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}