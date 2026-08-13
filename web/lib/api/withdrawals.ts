import { api } from "@/lib/api/http"
import { mapWithdrawal, type RawWithdrawal } from "@/lib/api/mappers"
import { toPaginated, type ListPayload, type Paginated } from "@/lib/api/types"
import type { Withdrawal, WithdrawalStatus } from "@/types"

export interface WithdrawalQuery {
  status?: WithdrawalStatus
  page?: number
  pageSize?: number
}

export async function apiGetMyWithdrawals(
  params?: WithdrawalQuery
): Promise<Paginated<Withdrawal>> {
  const pageSize = params?.pageSize ?? 20
  const { data } = await api.get<ListPayload<RawWithdrawal>>("/api/withdrawals", {
    status: params?.status,
    page: params?.page,
    page_size: pageSize,
  })
  return toPaginated(data.items.map(mapWithdrawal), data, pageSize)
}

export async function apiRequestWithdrawal(payload: {
  amount: number
  withdrawalType: "savings" | "contribution"
  bankName: string
  accountNumber: string
  accountName?: string
  destination: string
  contributionId?: string
}): Promise<Withdrawal> {
  const { data } = await api.post<RawWithdrawal>("/api/withdrawals", {
    amount: payload.amount,
    withdrawal_type: payload.withdrawalType,
    bank_name: payload.bankName,
    account_number: payload.accountNumber,
    account_name: payload.accountName,
    destination: payload.destination,
    contribution_id: payload.contributionId,
  })
  return mapWithdrawal(data)
}

export async function apiGetWithdrawal(id: string): Promise<Withdrawal> {
  const { data } = await api.get<RawWithdrawal>(`/api/withdrawals/${id}`)
  return mapWithdrawal(data)
}