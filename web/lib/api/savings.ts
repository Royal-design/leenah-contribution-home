import { api } from "@/lib/api/http"
import {
  mapSavingsAccount,
  mapSavingsGoal,
  type RawSavingsAccount,
  type RawSavingsGoal,
} from "@/lib/api/mappers"
import type { SavingsAccount, SavingsGoal, SavingsGoalStatus } from "@/types"

export interface FundSavingsPayload {
  goalId?: string
  amount: number
  method: "Bank Transfer" | "Card" | "Wallet"
}

export interface WithdrawSavingsPayload {
  amount: number
  destination: string
  bankName: string
  accountNumber: string
}

export async function apiGetSavings(): Promise<SavingsAccount> {
  const { data } = await api.get<RawSavingsAccount>("/api/wallet")
  return mapSavingsAccount(data)
}

export async function apiFundSavings(payload: FundSavingsPayload): Promise<void> {
  await api.post("/api/savings/fund", {
    amount: payload.amount,
    goal_id: payload.goalId,
    note: payload.method ? `Funded via ${payload.method}` : undefined,
  })
}

export async function apiWithdrawSavings(payload: WithdrawSavingsPayload): Promise<void> {
  await api.post("/api/withdrawals", {
    amount: payload.amount,
    withdrawal_type: "savings",
    bank_name: payload.bankName,
    account_number: payload.accountNumber,
    destination: payload.destination,
  })
}

export interface CreateSavingsGoalPayload {
  name: string
  target: number
  targetDate?: string
  color?: string
}

export interface UpdateSavingsGoalPayload {
  name?: string
  target?: number
  color?: string
  status?: SavingsGoalStatus
  targetDate?: string
}

export async function apiListSavingsGoals(): Promise<SavingsGoal[]> {
  const { data } = await api.get<RawSavingsGoal[]>("/api/savings/goals")
  return data.map(mapSavingsGoal)
}

export async function apiCreateSavingsGoal(payload: CreateSavingsGoalPayload): Promise<SavingsGoal> {
  const { data } = await api.post<RawSavingsGoal>("/api/savings/goals", {
    name: payload.name,
    target: payload.target,
    color: payload.color,
    target_date: payload.targetDate,
  })
  return mapSavingsGoal(data)
}

export async function apiUpdateSavingsGoal(
  id: string,
  payload: UpdateSavingsGoalPayload
): Promise<SavingsGoal> {
  const { data } = await api.patch<RawSavingsGoal>(`/api/savings/goals/${id}`, {
    name: payload.name,
    target: payload.target,
    color: payload.color,
    status: payload.status,
    target_date: payload.targetDate,
  })
  return mapSavingsGoal(data)
}

export async function apiDeleteSavingsGoal(id: string): Promise<void> {
  await api.delete(`/api/savings/goals/${id}`)
}