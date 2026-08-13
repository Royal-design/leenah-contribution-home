import { api } from "@/lib/api/http"
import type { RawAuditLog } from "@/lib/api/mappers"
import { toPaginated, type ListPayload, type Paginated } from "@/lib/api/types"
import type { AuditAction, AuditCategory, AuditLog } from "@/types"

export interface AuditLogQuery {
  page?: number
  pageSize?: number
  action?: AuditAction
  category?: AuditCategory
  search?: string
  from?: string
  to?: string
}

export function mapAuditLog(raw: RawAuditLog): AuditLog {
  return {
    id: raw.id,
    actorId: raw.actor_id ?? undefined,
    actorName: raw.actor_name ?? undefined,
    actorEmail: raw.actor_email ?? undefined,
    actorRole: raw.actor_role ?? undefined,
    action: raw.action as AuditAction,
    category: raw.category as AuditCategory,
    description: raw.description,
    target: raw.target ?? undefined,
    targetId: raw.target_id ?? undefined,
    details: raw.details ?? undefined,
    ipAddress: raw.ip_address ?? undefined,
    userAgent: raw.user_agent ?? undefined,
    createdAt: raw.created_at,
  }
}

export async function apiGetAuditLogs(
  params?: AuditLogQuery
): Promise<Paginated<AuditLog>> {
  const pageSize = params?.pageSize ?? 20
  const { data } = await api.get<ListPayload<RawAuditLog>>("/api/audit-logs", {
    page: params?.page,
    page_size: pageSize,
    action: params?.action,
    category: params?.category,
    search: params?.search,
    from: params?.from,
    to: params?.to,
  })
  return toPaginated(data.items.map(mapAuditLog), data, pageSize)
}

export async function apiGetAuditLogActions(): Promise<AuditAction[]> {
  const { data } = await api.get<AuditAction[]>("/api/audit-logs/actions")
  return data
}

export async function apiGetAuditLog(id: string): Promise<AuditLog> {
  const { data } = await api.get<RawAuditLog>(`/api/audit-logs/${id}`)
  return mapAuditLog(data)
}