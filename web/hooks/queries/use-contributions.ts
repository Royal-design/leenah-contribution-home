import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  apiFundContribution,
  apiGetContribution,
  apiGetContributions,
  apiJoinContribution,
  type JoinContributionPayload,
} from "@/lib/api/contributions"
import { queryKeys } from "@/hooks/queries/query-keys"

export function useContributions() {
  return useQuery({
    queryKey: queryKeys.contributions.all,
    queryFn: apiGetContributions,
  })
}

export function useContribution(id: string) {
  return useQuery({
    queryKey: queryKeys.contributions.detail(id),
    queryFn: () => apiGetContribution(id),
  })
}

export function useJoinContribution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: JoinContributionPayload) =>
      apiJoinContribution(payload),
    onSuccess: () => {
      toast.success("Contribution joined successfully.")
      queryClient.invalidateQueries({ queryKey: queryKeys.contributions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.recent })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useFundContribution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      apiFundContribution(id, amount),
    onSuccess: () => {
      toast.success("Contribution funded successfully.")
      queryClient.invalidateQueries({ queryKey: queryKeys.contributions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.recent })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}