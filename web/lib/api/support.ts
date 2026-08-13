import { api } from "@/lib/api/http"
import type { RawSupportMessage, RawSupportThread } from "@/lib/api/mappers"
import { toPaginated, type ListPayload, type Paginated } from "@/lib/api/types"
import type {
  SupportCategory,
  SupportMessage,
  SupportStatus,
  SupportThread,
  SupportThreadDetail,
} from "@/types"

export interface SupportThreadQuery {
  search?: string
  status?: SupportStatus
  page?: number
  pageSize?: number
}

function mapMessage(raw: RawSupportMessage): SupportMessage {
  return {
    id: raw.id,
    threadId: raw.thread_id,
    senderId: raw.sender_id ?? undefined,
    senderRole: raw.sender_role,
    senderName: raw.sender_name,
    body: raw.body,
    isRead: raw.is_read,
    createdAt: raw.created_at,
  }
}

function mapThread(raw: RawSupportThread): SupportThread {
  return {
    id: raw.id,
    userId: raw.user_id,
    userName: raw.user_name ?? undefined,
    userEmail: raw.user_email ?? undefined,
    subject: raw.subject,
    category: raw.category as SupportCategory,
    status: raw.status,
    unreadCount: raw.unread_count,
    lastMessageAt: raw.last_message_at,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

function mapThreadDetail(raw: RawSupportThread): SupportThreadDetail {
  return {
    ...mapThread(raw),
    messages: (raw.messages ?? []).map(mapMessage),
  }
}

export async function apiListSupportThreads(
  params?: SupportThreadQuery
): Promise<Paginated<SupportThread>> {
  const pageSize = params?.pageSize ?? 20
  const { data } = await api.get<ListPayload<RawSupportThread>>("/api/support/threads", {
    search: params?.search,
    status: params?.status,
    page: params?.page,
    page_size: pageSize,
  })
  return toPaginated(data.items.map(mapThread), data, pageSize)
}

export async function apiGetSupportThread(id: string): Promise<SupportThreadDetail> {
  const { data } = await api.get<RawSupportThread>(`/api/support/threads/${id}`)
  return mapThreadDetail(data)
}

export async function apiCreateSupportThread(payload: {
  subject: string
  category: SupportCategory
  message: string
}): Promise<SupportThreadDetail> {
  const { data } = await api.post<RawSupportThread>("/api/support/threads", payload)
  return mapThreadDetail(data)
}

export async function apiReplySupportThread(
  id: string,
  body: string
): Promise<SupportThreadDetail> {
  const { data } = await api.post<RawSupportThread>(
    `/api/support/threads/${id}/messages`,
    { body }
  )
  return mapThreadDetail(data)
}

export async function apiUpdateSupportThreadStatus(
  id: string,
  status: SupportStatus
): Promise<SupportThread> {
  const { data } = await api.patch<RawSupportThread>(
    `/api/support/threads/${id}/status`,
    { status }
  )
  return mapThread(data)
}

export async function apiGetSupportUnreadCount(): Promise<number> {
  const { data } = await api.get<{ unread_threads: number }>(
    "/api/support/threads/unread-count"
  )
  return data.unread_threads
}