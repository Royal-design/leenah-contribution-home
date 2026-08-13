import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  apiDeleteAuditLog,
  apiGetAuditLogActions,
  apiGetAuditLogs,
  type AuditLogQuery,
} from "@/lib/api/audit-logs"
import { queryKeys } from "@/hooks/queries/query-keys"
import { getErrorMessage } from "@/lib/api/types"
import type { AuditAction } from "@/types"

export function useAuditLogs(params?: AuditLogQuery) {
  return useQuery({
    queryKey: queryKeys.auditLogs.list(params ?? {}),
    queryFn: () => apiGetAuditLogs(params),
  })
}

export function useAuditLogActions() {
  return useQuery({
    queryKey: queryKeys.auditLogs.actions,
    queryFn: apiGetAuditLogActions,
  })
}

export function useDeleteAuditLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDeleteAuditLog(id),
    onSuccess: () => {
      toast.success("Audit log entry deleted.")
      queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function auditActionLabel(action: AuditAction): string {
  return action.replace(/_/g, " ")
}