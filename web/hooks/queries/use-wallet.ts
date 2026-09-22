import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  apiGetDVA,
  apiCreateDVA,
  apiRequeryDVA,
  apiInitializeCardFunding,
  apiVerifyCardFunding,
  apiListBanks,
  apiResolveBankAccount,
  apiListBankAccounts,
  apiSaveBankAccount,
  apiDeleteBankAccount,
  apiRequestWithdrawal,
  apiGetMyWithdrawals,
  apiPreviewWithdrawal,
  type InitializeCardPayload,
  type SaveBankAccountPayload,
  type RequestWithdrawalPayload,
} from "@/lib/api/wallet"
import { queryKeys } from "@/hooks/queries/query-keys"
import { getErrorMessage } from "@/lib/api/types"

/* ----------------------------------- DVA ----------------------------------- */

export function useDVA() {
  return useQuery({
    queryKey: queryKeys.wallet.dva,
    queryFn: apiGetDVA,
    staleTime: 30_000,
  })
}

export function useCreateDVA() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: apiCreateDVA,
    onSuccess: () => {
      toast.success("Virtual account created.")
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.dva })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useRequeryDVA() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: apiRequeryDVA,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.dva })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

/* -------------------------------- Card Funding ------------------------------- */

export function useInitializeCardFunding() {
  return useMutation({
    mutationFn: (payload: InitializeCardPayload) => apiInitializeCardFunding(payload),
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useVerifyCardFunding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reference: string) => apiVerifyCardFunding(reference),
    onSuccess: () => {
      toast.success("Payment confirmed.")
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

/* -------------------------------- Bank Accounts ------------------------------- */

export function useBanks() {
  return useQuery({
    queryKey: queryKeys.wallet.banks,
    queryFn: apiListBanks,
    staleTime: 300_000,
  })
}

export function useBankAccounts() {
  return useQuery({
    queryKey: queryKeys.wallet.bankAccounts,
    queryFn: apiListBankAccounts,
  })
}

export function useSaveBankAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SaveBankAccountPayload) => apiSaveBankAccount(payload),
    onSuccess: () => {
      toast.success("Bank account saved and verified.")
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.bankAccounts })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useDeleteBankAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDeleteBankAccount(id),
    onSuccess: () => {
      toast.success("Bank account deleted.")
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.bankAccounts })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

/* -------------------------------- Withdrawals -------------------------------- */

export function useRequestWithdrawal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: RequestWithdrawalPayload) => apiRequestWithdrawal(payload),
    onSuccess: () => {
      toast.success(
        "Withdrawal request submitted. Your withdrawal will be reviewed and processed within 24 hours."
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.savings.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.wallet.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })
}

export function useWithdrawalPreview(input: {
  amount: number
  withdrawalType: "savings" | "contribution"
  channel?: "wallet" | "bank"
  source?: "user" | "emergency" | "admin"
  contributionId?: string
  savingsPlanId?: string
} | null) {
  return useQuery({
    queryKey: ["withdrawal-preview", input ?? {}],
    queryFn: () =>
      apiPreviewWithdrawal({
        amount: input!.amount,
        withdrawalType: input!.withdrawalType,
        channel: input!.channel,
        source: input!.source,
        contributionId: input!.contributionId,
        savingsPlanId: input!.savingsPlanId,
      }),
    enabled: !!input && input.amount > 0,
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  })
}

export function useMyWithdrawals(params?: {
  status?: import("@/types").WithdrawalStatus
  page?: number
  pageSize?: number
}) {
  return useQuery({
    queryKey: queryKeys.withdrawals.list(params ?? {}),
    queryFn: () => apiGetMyWithdrawals(params),
  })
}
