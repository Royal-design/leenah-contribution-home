import { api } from "@/lib/api/http"
import {
  mapSavingsPlan,
  mapSavingsPlanEnrollmentDetail,
  type RawSavingsPlan,
  type RawSavingsPlanEnrollmentDetail,
} from "@/lib/api/mappers"
import { toPaginated, type ListPayload, type Paginated } from "@/lib/api/types"
import type { Frequency, SavingsPlan, SavingsPlanEnrollmentDetail, SavingsPlanStatus } from "@/types"

export interface SavingsPlansQuery {
  status?: SavingsPlanStatus
  page?: number
  pageSize?: number
}

export interface CreateSavingsPlanPayload {
  name: string
  description?: string
  organization?: string
  amount: number
  targetAmount?: number
  frequency: Frequency
  startDate: string
  durationMonths: number
  status?: SavingsPlanStatus
  isOpen?: boolean
}

export interface UpdateSavingsPlanPayload {
  name?: string
  description?: string
  organization?: string
  amount?: number
  targetAmount?: number
  frequency?: Frequency
  startDate?: string
  durationMonths?: number
  status?: SavingsPlanStatus
  isOpen?: boolean
}

/* ------------------------------- User -------------------------------- */

export async function apiGetMySavingsPlans(
  params?: SavingsPlansQuery
): Promise<Paginated<SavingsPlan>> {
  const pageSize = params?.pageSize ?? 20
  const { data } = await api.get<ListPayload<RawSavingsPlan>>("/api/savings-plans/mine", {
    status: params?.status,
    page: params?.page,
    page_size: pageSize,
  })
  return toPaginated(data.items.map(mapSavingsPlan), data, pageSize)
}

export async function apiGetOpenSavingsPlans(params?: {
  page?: number
  pageSize?: number
}): Promise<Paginated<SavingsPlan>> {
  const pageSize = params?.pageSize ?? 20
  const { data } = await api.get<ListPayload<RawSavingsPlan>>("/api/savings-plans/open", {
    page: params?.page,
    page_size: pageSize,
  })
  return toPaginated(data.items.map(mapSavingsPlan), data, pageSize)
}

export async function apiGetSavingsPlan(id: string): Promise<SavingsPlan> {
  const { data } = await api.get<RawSavingsPlan>(`/api/savings-plans/${id}`)
  return mapSavingsPlan(data)
}

export async function apiJoinSavingsPlan(id: string): Promise<SavingsPlan> {
  const { data } = await api.post<RawSavingsPlan>(`/api/savings-plans/${id}/join`)
  return mapSavingsPlan(data)
}

export async function apiLeaveSavingsPlan(id: string): Promise<void> {
  await api.post(`/api/savings-plans/${id}/leave`)
}

export async function apiPaySavingsPlan(
  id: string,
  opts: { scheduleId?: number } = {}
): Promise<SavingsPlan> {
  const { data } = await api.post<RawSavingsPlan>(`/api/savings-plans/${id}/pay`, {
    schedule_id: opts.scheduleId,
  })
  return mapSavingsPlan(data)
}

/* ------------------------------- Admin ------------------------------- */

export async function apiAdminListSavingsPlans(params?: {
  page?: number
  pageSize?: number
  search?: string
  status?: SavingsPlanStatus
}): Promise<Paginated<SavingsPlan>> {
  const pageSize = params?.pageSize ?? 20
  const { data } = await api.get<ListPayload<RawSavingsPlan>>("/api/admin/savings-plans", {
    page: params?.page,
    page_size: pageSize,
    search: params?.search,
    status: params?.status,
  })
  return toPaginated(data.items.map(mapSavingsPlan), data, pageSize)
}

export async function apiAdminGetSavingsPlan(id: string): Promise<SavingsPlan> {
  const { data } = await api.get<RawSavingsPlan>(`/api/admin/savings-plans/${id}`)
  return mapSavingsPlan(data)
}

export async function apiAdminCreateSavingsPlan(
  payload: CreateSavingsPlanPayload
): Promise<SavingsPlan> {
  const { data } = await api.post<RawSavingsPlan>("/api/admin/savings-plans", {
    name: payload.name,
    description: payload.description,
    organization: payload.organization,
    amount: payload.amount,
    target_amount: payload.targetAmount,
    frequency: payload.frequency,
    start_date: payload.startDate,
    duration_months: payload.durationMonths,
    status: payload.status,
    is_open: payload.isOpen,
  })
  return mapSavingsPlan(data)
}

export async function apiAdminUpdateSavingsPlan(
  id: string,
  payload: UpdateSavingsPlanPayload
): Promise<SavingsPlan> {
  const { data } = await api.patch<RawSavingsPlan>(`/api/admin/savings-plans/${id}`, {
    name: payload.name,
    description: payload.description,
    organization: payload.organization,
    amount: payload.amount,
    target_amount: payload.targetAmount,
    frequency: payload.frequency,
    start_date: payload.startDate,
    duration_months: payload.durationMonths,
    status: payload.status,
    is_open: payload.isOpen,
  })
  return mapSavingsPlan(data)
}

export async function apiAdminDeleteSavingsPlan(id: string): Promise<void> {
  await api.delete(`/api/admin/savings-plans/${id}`)
}

export async function apiAdminListSavingsPlanEnrollments(
  planId: string
): Promise<SavingsPlanEnrollmentDetail[]> {
  const { data } = await api.get<RawSavingsPlanEnrollmentDetail[]>(
    `/api/admin/savings-plans/${planId}/enrollments`
  )
  return data.map(mapSavingsPlanEnrollmentDetail)
}

export async function apiAdminAddSavingsPlanMember(
  planId: string,
  userId: string
): Promise<SavingsPlan> {
  const { data } = await api.post<RawSavingsPlan>(
    `/api/admin/savings-plans/${planId}/members`,
    { user_id: userId }
  )
  return mapSavingsPlan(data)
}

export async function apiAdminRemoveSavingsPlanMember(
  planId: string,
  userId: string
): Promise<SavingsPlan> {
  const { data } = await api.delete<RawSavingsPlan>(
    `/api/admin/savings-plans/${planId}/members/${userId}`
  )
  return mapSavingsPlan(data)
}