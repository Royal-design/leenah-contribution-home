import { getDb } from "@/lib/api/db"
import { mockMutation, mockRequest, makeReference } from "@/lib/api/client"
import type { Contribution, Transaction } from "@/types"

export function apiGetContributions(): Promise<Contribution[]> {
  return mockRequest(getDb().contributions)
}

export function apiGetContribution(id: string): Promise<Contribution> {
  return mockRequest(
    getDb().contributions.find((contribution) => contribution.id === id)!,
    300
  )
}

export interface JoinContributionPayload {
  contributionId: string
  name: string
  amount: number
  frequency: "weekly" | "biweekly" | "monthly" | "custom"
  startDate: string
  memberCount: number
  withdrawalDate: string
}

export function apiJoinContribution(
  payload: JoinContributionPayload
): Promise<Contribution> {
  return mockMutation(() => {
    const contribution: Contribution = {
      id: `ctb_${Date.now()}`,
      name: payload.name,
      description: "A contribution circle you just joined.",
      amount: payload.amount,
      frequency: payload.frequency,
      memberCount: payload.memberCount,
      startDate: payload.startDate,
      endDate: payload.withdrawalDate,
      withdrawalDate: payload.withdrawalDate,
      totalContributed: 0,
      totalExpected: payload.amount * payload.memberCount,
      progress: 0,
      status: "upcoming",
      nextPaymentDate: payload.startDate,
      members: [],
      schedule: [],
      withdrawalRule: {
        type: "fixed_date",
        eligibleDate: payload.withdrawalDate,
      },
      currentUserPosition: 1,
    }

    getDb().contributions.unshift(contribution)
    return contribution
  })
}

export function apiFundContribution(id: string, amount: number): Promise<void> {
  return mockMutation(() => {
    const contribution = getDb().contributions.find((entry) => entry.id === id)
    if (!contribution) {
      throw new Error("Contribution not found.")
    }

    const transaction: Transaction = {
      id: `txn_${Date.now()}`,
      type: "contribution",
      status: "successful",
      amount,
      description: `Contribution to ${contribution.name}`,
      date: new Date().toISOString(),
      reference: makeReference("LCH"),
      metadata: { contributionName: contribution.name, method: "Wallet" },
    }

    getDb().transactions.unshift(transaction)
  })
}

export function apiLeaveContribution(id: string): Promise<void> {
  return mockMutation(() => {
    getDb().contributions = getDb().contributions.filter(
      (entry) => entry.id !== id
    )
  })
}