import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  apiCreateContribution,
  apiDeleteContribution,
  apiFundContribution,
  apiGetContribution,
  apiGetContributions,
  apiGetOpenContributions,
  apiJoinContribution,
  apiLeaveContribution,
  apiUpdateContribution,
  type ContributionListQuery,
  type CreateContributionPayload,
  type UpdateContributionPayload,
} from "@/lib/api/contributions"
import { queryKeys } from "@/hooks/queries/query-keys"
import { getErrorMessage } from "@/lib/api/types"

export function useContributions(params?: ContributionListQuery) {
  return useQuery({
    queryKey: [...queryKeys.contributions.all, params],
    queryFn: () => apiGetContributions(params),
  })
}

export function useOpenContributions(params?: { page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: [...queryKeys.contributions.open, params],
    queryFn: () => apiGetOpenContributions(params),
  })
}

export function useContribution(id: string) {
  return useQuery({
    queryKey: queryKeys.contributions.detail(id),
    queryFn: () => apiGetContribution(id),
    enabled: !!id,
  })
}

export function useCreateContribution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateContributionPayload) =>
      apiCreateContribution(payload),
    onSuccess: () => {
      toast.success("Contribution created successfully.")
      queryClient.invalidateQueries({ queryKey: queryKeys.contributions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.contributions.open })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.recent })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useJoinContribution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiJoinContribution(id),
    onSuccess: () => {
      toast.success("You've joined the contribution.")
      queryClient.invalidateQueries({ queryKey: queryKeys.contributions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.contributions.open })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useLeaveContribution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiLeaveContribution(id),
    onSuccess: () => {
      toast.success("You've left the contribution.")
      queryClient.invalidateQueries({ queryKey: queryKeys.contributions.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useFundContribution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount, scheduleId }: { id: string; amount?: number; scheduleId?: number }) =>
      apiFundContribution(id, { amount, scheduleId }),
    onSuccess: () => {
      toast.success("Contribution funded successfully.")
      queryClient.invalidateQueries({ queryKey: queryKeys.contributions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.recent })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateContribution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateContributionPayload }) =>
      apiUpdateContribution(id, payload),
    onSuccess: (updated) => {
      toast.success("Contribution updated.")
      queryClient.invalidateQueries({ queryKey: queryKeys.contributions.all })
      queryClient.invalidateQueries({
        queryKey: queryKeys.contributions.detail(updated.id),
      })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useDeleteContribution() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDeleteContribution(id),
    onSuccess: () => {
      toast.success("Contribution deleted.")
      queryClient.invalidateQueries({ queryKey: queryKeys.contributions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.contributions.open })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}