import { getDb } from "@/lib/api/db"
import { mockMutation, mockRequest, makeReference } from "@/lib/api/client"
import type { SavingsAccount, SavingsGoal, Transaction } from "@/types"

export function apiGetSavings(): Promise<SavingsAccount> {
  return mockRequest(getDb().savings)
}

export interface FundSavingsPayload {
  goalId?: string
  amount: number
  method: "Bank Transfer" | "Card" | "Wallet"
}

export function apiFundSavings(payload: FundSavingsPayload): Promise<void> {
  return mockMutation(() => {
    const goal = getDb().savings.goals.find(
      (entry) => entry.id === payload.goalId
    )
    if (goal) {
      goal.current += payload.amount
    }
    getDb().savings.balance += payload.amount
    getDb().savings.totalSaved += payload.amount

    const transaction: Transaction = {
      id: `txn_${Date.now()}`,
      type: "savings",
      status: "successful",
      amount: payload.amount,
      description: `Saved to ${goal?.name ?? "wallet"}`,
      date: new Date().toISOString(),
      reference: makeReference("LCH"),
      metadata: { method: payload.method },
    }

    getDb().transactions.unshift(transaction)
  })
}

export interface WithdrawSavingsPayload {
  amount: number
  destination: string
  bankName: string
  accountNumber: string
}

export function apiWithdrawSavings(
  payload: WithdrawSavingsPayload
): Promise<void> {
  return mockMutation(() => {
    if (payload.amount > getDb().savings.balance) {
      throw new Error("You do not have enough savings to withdraw that amount.")
    }
    getDb().savings.balance -= payload.amount
    getDb().savings.totalWithdrawn += payload.amount

    const transaction: Transaction = {
      id: `txn_${Date.now()}`,
      type: "withdrawal",
      status: "pending",
      amount: payload.amount,
      description: `Savings withdrawal to ${payload.bankName} (${payload.accountNumber})`,
      date: new Date().toISOString(),
      reference: makeReference("LCH"),
      metadata: {
        method: "Bank Transfer",
        destination: `${payload.bankName} ••${payload.accountNumber.slice(-4)}`,
      },
    }

    getDb().transactions.unshift(transaction)
  })
}

export function apiCreateSavingsGoal(payload: {
  name: string
  target: number
  targetDate?: string
}): Promise<SavingsGoal> {
  return mockMutation(() => {
    const goal: SavingsGoal = {
      id: `svg_${Date.now()}`,
      name: payload.name,
      target: payload.target,
      current: 0,
      status: "active",
      createdAt: new Date().toISOString(),
      targetDate: payload.targetDate,
    }
    getDb().savings.goals.unshift(goal)
    return goal
  })
}