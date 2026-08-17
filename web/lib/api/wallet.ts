import { api } from "@/lib/api/http"
import {
  mapBank,
  mapBankAccount,
  mapDVA,
  type RawBank,
  type RawBankAccount,
  type RawDVA,
} from "@/lib/api/mappers"
import type { Bank, BankAccount, DVA } from "@/types"

/* ----------------------------------- DVA ----------------------------------- */

export async function apiGetDVA(): Promise<DVA | null> {
  const { data } = await api.get<{ dva: RawDVA | null; message: string | null }>("/api/wallet/dva")
  return data.dva ? mapDVA(data.dva) : null
}

export async function apiCreateDVA(): Promise<DVA> {
  const { data } = await api.post<{ dva: RawDVA }>("/api/wallet/dva/create")
  return mapDVA(data.dva)
}

export async function apiRequeryDVA(): Promise<DVA> {
  const { data } = await api.post<{ dva: RawDVA }>("/api/wallet/dva/requery")
  return mapDVA(data.dva)
}

/* -------------------------------- Card Funding ------------------------------- */

export interface InitializeCardPayload {
  amount: number
  callbackUrl?: string
}

export interface CardInitResult {
  authorizationUrl: string
  reference: string
  accessCode?: string
}

export async function apiInitializeCardFunding(
  payload: InitializeCardPayload
): Promise<CardInitResult> {
  const { data } = await api.post<{ authorization_url: string; reference: string; access_code: string | null }>(
    "/api/wallet/fund/card/initialize",
    {
      amount: payload.amount,
      callback_url: payload.callbackUrl,
    }
  )
  return {
    authorizationUrl: data.authorization_url,
    reference: data.reference,
    accessCode: data.access_code ?? undefined,
  }
}

export async function apiVerifyCardFunding(reference: string): Promise<{ success: boolean }> {
  const { data } = await api.get<{ authorization_url: string; reference: string }>(
    `/api/wallet/fund/card/verify/${reference}`
  )
  return { success: !!data.reference }
}

/* -------------------------------- Bank Accounts ------------------------------- */

export async function apiListBanks(): Promise<Bank[]> {
  const { data } = await api.get<{ banks: RawBank[] }>("/api/bank-accounts/banks")
  return data.banks.map(mapBank)
}

export async function apiResolveBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<{ accountNumber: string; bankCode: string; bankName: string; accountName: string; verified: boolean; maskedAccountNumber: string }> {
  const { data } = await api.post<{
    account_number: string
    bank_code: string
    bank_name: string
    account_name: string
    verified: boolean
    masked_account_number: string
  }>("/api/bank-accounts/resolve", {
    account_number: accountNumber,
    bank_code: bankCode,
  })
  return {
    accountNumber: data.account_number,
    bankCode: data.bank_code,
    bankName: data.bank_name,
    accountName: data.account_name,
    verified: data.verified,
    maskedAccountNumber: data.masked_account_number,
  }
}

export async function apiListBankAccounts(): Promise<BankAccount[]> {
  const { data } = await api.get<RawBankAccount[]>("/api/bank-accounts")
  return data.map(mapBankAccount)
}

export interface SaveBankAccountPayload {
  bankCode: string
  bankName: string
  accountNumber: string
  isDefault?: boolean
}

export async function apiSaveBankAccount(
  payload: SaveBankAccountPayload
): Promise<BankAccount> {
  const { data } = await api.post<RawBankAccount>("/api/bank-accounts", {
    bank_code: payload.bankCode,
    bank_name: payload.bankName,
    account_number: payload.accountNumber,
    is_default: payload.isDefault ?? false,
  })
  return mapBankAccount(data)
}

export async function apiDeleteBankAccount(id: string): Promise<void> {
  await api.delete(`/api/bank-accounts/${id}`)
}

/* -------------------------------- Withdrawals -------------------------------- */

export interface RequestWithdrawalPayload {
  amount: number
  bankAccountId?: string
  bankName?: string
  accountNumber?: string
  accountName?: string
  destination?: string
  contributionId?: string
}

export async function apiRequestWithdrawal(payload: RequestWithdrawalPayload): Promise<void> {
  await api.post("/api/withdrawals", {
    amount: payload.amount,
    withdrawal_type: "savings",
    bank_account_id: payload.bankAccountId,
    bank_name: payload.bankName,
    account_number: payload.accountNumber,
    account_name: payload.accountName,
    destination: payload.destination,
    contribution_id: payload.contributionId,
  })
}
