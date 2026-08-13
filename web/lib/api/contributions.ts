import { api } from "@/lib/api/http"
import {
  mapContribution,
  type RawContribution,
} from "@/lib/api/mappers"
import { toPaginated, type Paginated, type ListPayload } from "@/lib/api/types"
import type { Contribution, ContributionStatus, Frequency } from "@/types"

export interface ContributionListQuery {
  status?: ContributionStatus
  page?: number
  pageSize?: number
}

export interface CreateContributionPayload {
  name: string
  description?: string
  organization?: string
  amount: number
  frequency: Frequency
  memberCount: number
  rounds?: number
  startDate: string
  withdrawalDate?: string
}

export interface UpdateContributionPayload {
  name?: string
  description?: string
  amount?: number
  frequency?: Frequency
  memberCount?: number
  rounds?: number
  startDate?: string
  status?: ContributionStatus
  isOpen?: boolean
}

export async function apiGetContributions(
  params?: ContributionListQuery
): Promise<Paginated<Contribution>> {
  const { data } = await api.get<ListPayload<RawContribution>>("/api/contributions", {
    status: params?.status,
    page: params?.page,
    page_size: params?.pageSize,
  })
  return toPaginated(data.items.map(mapContribution), data, params?.pageSize ?? 20)
}

export async function apiGetOpenContributions(params?: {
  page?: number
  pageSize?: number
}): Promise<Paginated<Contribution>> {
  const { data } = await api.get<ListPayload<RawContribution>>("/api/contributions/open", {
    page: params?.page,
    page_size: params?.pageSize,
  })
  return toPaginated(data.items.map(mapContribution), data, params?.pageSize ?? 20)
}

export async function apiGetContribution(id: string): Promise<Contribution> {
  const { data } = await api.get<RawContribution>(`/api/contributions/${id}`)
  return mapContribution(data)
}

export async function apiCreateContribution(payload: CreateContributionPayload): Promise<Contribution> {
  const { data } = await api.post<RawContribution>("/api/contributions", {
    name: payload.name,
    description: payload.description,
    organization: payload.organization,
    amount: payload.amount,
    frequency: payload.frequency,
    member_count: payload.memberCount,
    rounds: payload.rounds ?? 12,
    start_date: payload.startDate,
    withdrawal_rule: payload.withdrawalDate ? "fixed_date" : undefined,
    fixed_withdrawal_date: payload.withdrawalDate,
  })
  return mapContribution(data)
}

export async function apiJoinContribution(id: string): Promise<Contribution> {
  const { data } = await api.post<RawContribution>(`/api/contributions/${id}/join`)
  return mapContribution(data)
}

export async function apiLeaveContribution(id: string): Promise<void> {
  await api.post(`/api/contributions/${id}/leave`)
}

export async function apiFundContribution(id: string, amount?: number): Promise<Contribution> {
  const { data } = await api.post<RawContribution>(`/api/contributions/${id}/pay`, {
    amount,
  })
  return mapContribution(data)
}

export async function apiUpdateContribution(
  id: string,
  payload: UpdateContributionPayload
): Promise<Contribution> {
  const { data } = await api.patch<RawContribution>(`/api/contributions/${id}`, {
    name: payload.name,
    description: payload.description,
    amount: payload.amount,
    frequency: payload.frequency,
    member_count: payload.memberCount,
    rounds: payload.rounds,
    start_date: payload.startDate,
    status: payload.status,
    is_open: payload.isOpen,
  })
  return mapContribution(data)
}

export async function apiDeleteContribution(id: string): Promise<void> {
  await api.delete(`/api/contributions/${id}`)
}