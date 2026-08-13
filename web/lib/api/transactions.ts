import { api } from "@/lib/api/http"
import { mapTransaction, type RawTransaction } from "@/lib/api/mappers"
import { toPaginated, type ListPayload, type Paginated } from "@/lib/api/types"
import type { Transaction, TransactionStatus, TransactionType } from "@/types"

export interface TransactionQuery {
  search?: string
  type?: TransactionType | "all"
  status?: TransactionStatus | "all"
  page?: number
  pageSize?: number
}

function toTypeFilter(type?: TransactionType | "all"): TransactionType | undefined {
  return type && type !== "all" ? type : undefined
}

function toStatusFilter(status?: TransactionStatus | "all"): TransactionStatus | undefined {
  return status && status !== "all" ? status : undefined
}

export async function apiGetTransactions(
  filters?: TransactionQuery
): Promise<Paginated<Transaction>> {
  const page = filters?.page ?? 1
  const pageSize = filters?.pageSize ?? 20
  const type = toTypeFilter(filters?.type)
  const status = toStatusFilter(filters?.status)

  // The backend has no `search` param for transactions, so when searching we
  // fetch a generous slice and paginate + filter it client-side.
  if (filters?.search) {
    const { data } = await api.get<ListPayload<RawTransaction>>("/api/transactions", {
      type,
      status,
      page: 1,
      page_size: 100,
    })
    const query = filters.search.toLowerCase()
    const matches = data.items
      .map(mapTransaction)
      .filter((txn) =>
        `${txn.description} ${txn.reference}`.toLowerCase().includes(query)
      )
    const start = (page - 1) * pageSize
    return {
      items: matches.slice(start, start + pageSize),
      page,
      pageSize,
      total: matches.length,
      totalPages: Math.max(1, Math.ceil(matches.length / pageSize)),
    }
  }

  const { data } = await api.get<ListPayload<RawTransaction>>("/api/transactions", {
    type,
    status,
    page,
    page_size: pageSize,
  })
  return toPaginated(data.items.map(mapTransaction), data, pageSize)
}

export async function apiGetRecentTransactions(limit = 5): Promise<Transaction[]> {
  const { data } = await api.get<ListPayload<RawTransaction>>("/api/transactions", {
    page: 1,
    page_size: limit,
  })
  return data.items.map(mapTransaction)
}

export async function apiGetTransaction(id: string): Promise<Transaction> {
  const { data } = await api.get<RawTransaction>(`/api/transactions/${id}`)
  return mapTransaction(data)
}