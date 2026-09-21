import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  apiAdminAddSavingsPlanMember,
  apiAdminCreateSavingsPlan,
  apiAdminDeleteSavingsPlan,
  apiAdminGetSavingsPlan,
  apiAdminListSavingsPlanEnrollments,
  apiAdminListSavingsPlans,
  apiAdminRemoveSavingsPlanMember,
  apiAdminUpdateSavingsPlan,
  apiGetMySavingsPlans,
  apiGetOpenSavingsPlans,
  apiGetSavingsPlan,
  apiJoinSavingsPlan,
  apiLeaveSavingsPlan,
  apiPaySavingsPlan,
  type CreateSavingsPlanPayload,
  type SavingsPlansQuery,
  type UpdateSavingsPlanPayload,
} from "@/lib/api/savings-plans"
import { queryKeys } from "@/hooks/queries/query-keys"
import { getErrorMessage } from "@/lib/api/types"
import type { SavingsPlanStatus } from "@/types"

/* ------------------------------- User -------------------------------- */

export function useMySavingsPlans(params?: SavingsPlansQuery) {
  return useQuery({
    queryKey: [...queryKeys.savingsPlans.mine, params],
    queryFn: () => apiGetMySavingsPlans(params),
  })
}

export function useOpenSavingsPlans(params?: { page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: [...queryKeys.savingsPlans.open, params],
    queryFn: () => apiGetOpenSavingsPlans(params),
  })
}

export function useSavingsPlan(id: string) {
  return useQuery({
    queryKey: queryKeys.savingsPlans.detail(id),
    queryFn: () => apiGetSavingsPlan(id),
    enabled: !!id,
  })
}

export function useJoinSavingsPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiJoinSavingsPlan(id),
    onSuccess: () => {
      toast.success("You've joined this savings plan.")
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPlans.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPlans.mine })
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPlans.open })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useLeaveSavingsPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiLeaveSavingsPlan(id),
    onSuccess: () => {
      toast.success("You've left this savings plan.")
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPlans.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPlans.mine })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function usePaySavingsPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, scheduleId }: { id: string; scheduleId?: number }) =>
      apiPaySavingsPlan(id, { scheduleId }),
    onSuccess: () => {
      toast.success("Savings payment recorded.")
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPlans.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPlans.mine })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.recent })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

/* ------------------------------- Admin ------------------------------- */

export function useAdminSavingsPlans(params?: {
  page?: number
  pageSize?: number
  search?: string
  status?: SavingsPlanStatus
}) {
  return useQuery({
    queryKey: queryKeys.adminSavingsPlans.list(params ?? {}),
    queryFn: () => apiAdminListSavingsPlans(params),
  })
}

export function useAdminSavingsPlan(id: string) {
  return useQuery({
    queryKey: queryKeys.adminSavingsPlans.detail(id),
    queryFn: () => apiAdminGetSavingsPlan(id),
    enabled: !!id,
  })
}

export function useAdminCreateSavingsPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSavingsPlanPayload) => apiAdminCreateSavingsPlan(payload),
    onSuccess: () => {
      toast.success("Savings plan created.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSavingsPlans.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPlans.open })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useAdminUpdateSavingsPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateSavingsPlanPayload }) =>
      apiAdminUpdateSavingsPlan(id, payload),
    onSuccess: (updated) => {
      toast.success("Savings plan updated.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSavingsPlans.all })
      queryClient.invalidateQueries({
        queryKey: queryKeys.adminSavingsPlans.detail(updated.id),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPlans.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useAdminDeleteSavingsPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiAdminDeleteSavingsPlan(id),
    onSuccess: () => {
      toast.success("Savings plan deleted.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSavingsPlans.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPlans.open })
      queryClient.invalidateQueries({ queryKey: queryKeys.adminStats })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useAdminSavingsPlanEnrollments(planId: string) {
  return useQuery({
    queryKey: queryKeys.adminSavingsPlans.enrollments(planId),
    queryFn: () => apiAdminListSavingsPlanEnrollments(planId),
    enabled: !!planId,
  })
}

export function useAdminAddSavingsPlanMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, userId }: { planId: string; userId: string }) =>
      apiAdminAddSavingsPlanMember(planId, userId),
    onSuccess: (updated) => {
      toast.success("Member added.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSavingsPlans.all })
      queryClient.invalidateQueries({
        queryKey: queryKeys.adminSavingsPlans.detail(updated.id),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.adminSavingsPlans.enrollments(updated.id),
      })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useAdminRemoveSavingsPlanMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ planId, userId }: { planId: string; userId: string }) =>
      apiAdminRemoveSavingsPlanMember(planId, userId),
    onSuccess: (updated) => {
      toast.success("Member removed.")
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSavingsPlans.all })
      queryClient.invalidateQueries({
        queryKey: queryKeys.adminSavingsPlans.detail(updated.id),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.adminSavingsPlans.enrollments(updated.id),
      })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}