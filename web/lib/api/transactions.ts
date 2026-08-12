import { getDb } from "@/lib/api/db"
import { mockRequest } from "@/lib/api/client"
import type {
  AppNotification,
  Transaction,
  TransactionStatus,
  TransactionType,
} from "@/types"

export interface TransactionFilters {
  search?: string
  type?: TransactionType | "all"
  status?: TransactionStatus | "all"
}

export function apiGetTransactions(
  filters?: TransactionFilters
): Promise<Transaction[]> {
  return mockRequest(filterTransactions(filters))
}

export function apiGetRecentTransactions(limit = 5): Promise<Transaction[]> {
  return mockRequest(getDb().transactions.slice(0, limit), 300)
}

function filterTransactions(filters?: TransactionFilters) {
  let result = [...getDb().transactions]

  if (filters?.search) {
    const query = filters.search.toLowerCase()
    result = result.filter((txn) =>
      `${txn.description} ${txn.reference}`.toLowerCase().includes(query)
    )
  }

  if (filters?.type && filters.type !== "all") {
    result = result.filter((txn) => txn.type === filters.type)
  }

  if (filters?.status && filters.status !== "all") {
    result = result.filter((txn) => txn.status === filters.status)
  }

  return result
}

export function apiGetNotifications(): Promise<AppNotification[]> {
  return mockRequest(getDb().notifications)
}

export interface UpdateNotificationsPayload {
  ids: string[]
}

export function apiUpdateNotifications(
  payload: UpdateNotificationsPayload
): Promise<void> {
  return mockRequest(undefined, 200).then(() => {
    getDb().notifications.forEach((notification) => {
      if (payload.ids.includes(notification.id)) {
        notification.read = true
      }
    })
  })
}