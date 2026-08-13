import { useQuery } from "@tanstack/react-query"

import {
  apiGetAuditLogActions,
  apiGetAuditLogs,
  type AuditLogQuery,
} from "@/lib/api/audit-logs"
import { queryKeys } from "@/hooks/queries/query-keys"
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

export function auditActionLabel(action: AuditAction): string {
  return action.replace(/_/g, " ")
}