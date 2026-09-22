import { api } from "@/lib/api/http"
import { mapTransaction, type RawTransaction } from "@/lib/api/mappers"
import { toPaginated, type ListPayload, type Paginated } from "@/lib/api/types"
import type { Transaction, TransactionStatus, TransactionType } from "@/types"

export interface TransactionQuery {
  search?: string
  type?: TransactionType | "all" | "emergency" | "commission"
  status?: TransactionStatus | "all"
  page?: number
  pageSize?: number
}

function toTypeFilter(type?: TransactionQuery["type"]): TransactionType | undefined {
  return type && type !== "all" && type !== "emergency" && type !== "commission"
    ? type
    : undefined
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

  // Emergency and commission views live client-side because they depend on
  // per-row fields (source / commission). When one is active we fetch a
  // generous slice and paginate + filter locally (same approach as search).
  const localView =
    Boolean(filters?.search) ||
    filters?.type === "emergency" ||
    filters?.type === "commission"

  if (localView) {
    const { data } = await api.get<ListPayload<RawTransaction>>("/api/transactions", {
      type,
      status,
      page: 1,
      page_size: 100,
    })
    const query = filters?.search?.toLowerCase()
    let matches = data.items.map(mapTransaction).filter(
      (txn) =>
        (!query || `${txn.description} ${txn.reference}`.toLowerCase().includes(query))
    )

    if (filters?.type === "emergency") {
      matches = matches.filter((txn) => txn.source === "emergency")
    }
    if (filters?.type === "commission") {
      matches = matches.filter((txn) => (txn.commissionAmount ?? 0) > 0)
    }

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