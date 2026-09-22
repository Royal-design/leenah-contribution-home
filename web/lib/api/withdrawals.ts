import { api } from "@/lib/api/http"
import { mapWithdrawal, type RawWithdrawal } from "@/lib/api/mappers"
import { toPaginated, type ListPayload, type Paginated } from "@/lib/api/types"
import type { Withdrawal, WithdrawalChannel, WithdrawalStatus } from "@/types"

export interface WithdrawalQuery {
  status?: WithdrawalStatus
  page?: number
  pageSize?: number
}

export interface RequestWithdrawalInput {
  amount: number
  withdrawalType: "savings" | "contribution"
  channel?: WithdrawalChannel
  source?: "user" | "emergency"
  reason?: string
  bankAccountId?: string
  bankName?: string
  accountNumber?: string
  accountName?: string
  destination?: string
  contributionId?: string
  savingsPlanId?: string
}

export interface WithdrawalPreview {
  amount: number
  source: string
  channel: string
  gross: number
  commission: number
  commissionRate?: number
  commissionType?: string
  fee?: number
  net: number
}

export interface WithdrawalPreviewInput {
  amount: number
  withdrawalType: "savings" | "contribution"
  channel?: WithdrawalChannel
  source?: "user" | "emergency" | "admin"
  contributionId?: string
  savingsPlanId?: string
}

export async function apiPreviewWithdrawal(
  payload: WithdrawalPreviewInput
): Promise<WithdrawalPreview> {
  const { data } = await api.post<WithdrawalPreview>("/api/withdrawals/preview", {
    amount: payload.amount,
    withdrawal_type: payload.withdrawalType,
    channel: payload.channel,
    source: payload.source,
    contribution_id: payload.contributionId,
    savings_plan_id: payload.savingsPlanId,
  })
  return data
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

export async function apiRequestWithdrawal(payload: RequestWithdrawalInput): Promise<Withdrawal> {
  const { data } = await api.post<RawWithdrawal>("/api/withdrawals", {
    amount: payload.amount,
    withdrawal_type: payload.withdrawalType,
    channel: payload.channel,
    source: payload.source,
    reason: payload.reason,
    bank_account_id: payload.bankAccountId,
    bank_name: payload.bankName,
    account_number: payload.accountNumber,
    account_name: payload.accountName,
    destination: payload.destination,
    contribution_id: payload.contributionId,
    savings_plan_id: payload.savingsPlanId,
  })
  return mapWithdrawal(data)
}

export async function apiGetWithdrawal(id: string): Promise<Withdrawal> {
  const { data } = await api.get<RawWithdrawal>(`/api/withdrawals/${id}`)
  return mapWithdrawal(data)
}