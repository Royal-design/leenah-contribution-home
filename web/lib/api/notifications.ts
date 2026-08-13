import { api } from "@/lib/api/http"
import { mapNotification, type RawNotification } from "@/lib/api/mappers"
import type { Paginated } from "@/lib/api/types"
import type { AppNotification } from "@/types"

export interface RawNotificationList {
  items: RawNotification[]
  unread_count: number
  total: number
  page: number
  page_size: number
  pages: number
}

export interface NotificationListResult extends Paginated<AppNotification> {
  unreadCount: number
}

export async function apiGetNotifications(params?: {
  page?: number
  pageSize?: number
}): Promise<NotificationListResult> {
  const pageSize = params?.pageSize ?? 20
  const { data } = await api.get<RawNotificationList>("/api/notifications", {
    page: params?.page,
    page_size: pageSize,
  })
  return {
    items: data.items.map(mapNotification),
    page: data.page,
    pageSize: data.page_size,
    total: data.total,
    totalPages: Math.max(1, Math.ceil(data.total / Math.max(1, data.page_size))),
    unreadCount: data.unread_count,
  }
}

export async function apiGetUnreadCount(): Promise<number> {
  const { data } = await api.get<{ unread_count: number }>("/api/notifications/unread-count")
  return data.unread_count
}

export async function apiMarkAllNotificationsRead(): Promise<number> {
  const { data } = await api.patch<{ marked: number }>("/api/notifications/read-all")
  return data.marked
}

export async function apiMarkNotificationRead(id: string): Promise<void> {
  await api.patch(`/api/notifications/${id}/read`)
}

export async function apiUpdateNotifications(payload: { ids: string[] }): Promise<void> {
  if (payload.ids.length === 0) {
    return
  }
  await Promise.allSettled(
    payload.ids.map((id) => api.patch(`/api/notifications/${id}/read`))
  )
}