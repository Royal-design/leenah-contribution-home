import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  apiCreateSupportThread,
  apiGetSupportThread,
  apiGetSupportUnreadCount,
  apiListSupportThreads,
  apiReplySupportThread,
  apiUpdateSupportThreadStatus,
  type SupportThreadQuery,
} from "@/lib/api/support"
import { queryKeys } from "@/hooks/queries/query-keys"
import { getErrorMessage } from "@/lib/api/types"
import type { SupportCategory, SupportStatus } from "@/types"

export function useSupportThreads(params?: SupportThreadQuery) {
  return useQuery({
    queryKey: queryKeys.support.list(params ?? {}),
    queryFn: () => apiListSupportThreads(params),
  })
}

export function useSupportThread(id: string) {
  return useQuery({
    queryKey: queryKeys.support.detail(id),
    queryFn: () => apiGetSupportThread(id),
    enabled: !!id,
  })
}

export function useSupportUnreadCount() {
  return useQuery({
    queryKey: queryKeys.support.unreadCount,
    queryFn: apiGetSupportUnreadCount,
  })
}

export function useCreateSupportThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      subject: string
      category: SupportCategory
      message: string
    }) => apiCreateSupportThread(payload),
    onSuccess: () => {
      toast.success("Message sent.")
      queryClient.invalidateQueries({ queryKey: queryKeys.support.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.support.unreadCount })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useReplySupportThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      apiReplySupportThread(id, body),
    onSuccess: (thread) => {
      toast.success("Reply sent.")
      queryClient.invalidateQueries({ queryKey: queryKeys.support.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.support.detail(thread.id) })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useUpdateSupportThreadStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SupportStatus }) =>
      apiUpdateSupportThreadStatus(id, status),
    onSuccess: (thread) => {
      toast.success("Thread updated.")
      queryClient.invalidateQueries({ queryKey: queryKeys.support.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.support.detail(thread.id) })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}