"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, type Resolver } from "react-hook-form"
import * as z from "zod"
import { Plus, Check, Loader2, Building2, ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { formatNaira } from "@/lib/format"
import { useRequestWithdrawal } from "@/hooks/queries/use-wallet"
import { useBankAccounts, useSaveBankAccount, useBanks } from "@/hooks/queries/use-wallet"
import { apiResolveBankAccount } from "@/lib/api/wallet"
import type { BankAccount } from "@/types"

const formSchema = z.object({
  amount: z.coerce
    .number({ message: "Enter a valid amount." })
    .int("Amount must be a whole number.")
    .positive("Amount must be greater than zero."),
})

type FormValues = z.infer<typeof formSchema>

function BankPicker({
  banks,
  loading,
  value,
  onChange,
}: {
  banks: { code: string; name: string }[]
  loading: boolean
  value: string
  onChange: (code: string, name: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const selected = banks.find((b) => b.code === value)
  const filtered = banks.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className={selected ? "" : "text-muted-foreground"}>
          {loading ? "Loading banks..." : selected?.name ?? "Select bank"}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
          <div className="border-b p-1.5">
            <input
              type="text"
              placeholder="Search banks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full rounded-md border-0 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No banks found
              </p>
            )}
            {filtered.map((bank) => (
              <button
                key={bank.code}
                type="button"
                onClick={() => {
                  onChange(bank.code, bank.name)
                  setOpen(false)
                  setSearch("")
                }}
                className={`flex w-full items-center rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${
                  value === bank.code ? "bg-accent text-accent-foreground font-medium" : ""
                }`}
              >
                {bank.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AddBankAccountForm({ onDone }: { onDone: () => void }) {
  const saveBank = useSaveBankAccount()
  const { data: banks, isLoading: banksLoading } = useBanks()
  const [bankCode, setBankCode] = React.useState("")
  const [bankName, setBankName] = React.useState("")
  const [accountNumber, setAccountNumber] = React.useState("")
  const [resolvedName, setResolvedName] = React.useState<string | null>(null)
  const [resolving, setResolving] = React.useState(false)
  const [resolved, setResolved] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleResolve() {
    if (!bankCode || accountNumber.length < 10) return
    setResolving(true)
    setError(null)
    setResolved(false)
    setResolvedName(null)
    try {
      const result = await apiResolveBankAccount(accountNumber, bankCode)
      setResolvedName(result.accountName)
      setResolved(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not verify account.")
    } finally {
      setResolving(false)
    }
  }

  function handleSave() {
    if (!resolved || !resolvedName) return
    saveBank.mutate(
      { bankCode, bankName, accountNumber, isDefault: true },
      { onSuccess: onDone }
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel>Bank</FieldLabel>
        <BankPicker
          banks={banks ?? []}
          loading={banksLoading}
          value={bankCode}
          onChange={(code, name) => {
            setBankCode(code)
            setBankName(name)
            setResolved(false)
            setResolvedName(null)
          }}
        />
      </Field>

      <Field>
        <FieldLabel>Account number</FieldLabel>
        <div className="flex gap-2">
          <InputGroup className="flex-1">
            <InputGroupInput
              type="text"
              inputMode="numeric"
              maxLength={10}
              placeholder="0000000000"
              value={accountNumber}
              onChange={(e) => {
                setAccountNumber(e.target.value.replace(/\D/g, ""))
                setResolved(false)
                setResolvedName(null)
              }}
            />
          </InputGroup>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResolve}
            disabled={resolving || accountNumber.length < 10 || !bankCode}
          >
            {resolving ? <Loader2 className="size-3.5 animate-spin" /> : "Verify"}
          </Button>
        </div>
      </Field>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {resolved && resolvedName && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
          <Check className="size-4 shrink-0 text-green-600 dark:text-green-400" />
          <div className="min-w-0">
            <p className="text-xs text-green-700 dark:text-green-400">Account verified</p>
            <p className="truncate text-sm font-medium">{resolvedName}</p>
          </div>
        </div>
      )}

      <Button
        type="button"
        size="sm"
        disabled={!resolved || saveBank.isPending}
        onClick={handleSave}
      >
        {saveBank.isPending && <Loader2 className="size-3.5 animate-spin" />}
        Save account
      </Button>
    </div>
  )
}

export function WithdrawDialog({
  open,
  onOpenChange,
  balance,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  balance: number
}) {
  const { data: accounts, isLoading: accountsLoading } = useBankAccounts()
  const withdraw = useRequestWithdrawal()
  const [showAddBank, setShowAddBank] = React.useState(false)
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: { amount: undefined },
  })

  const amount = form.watch("amount")
  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId)
  const verifiedAccounts = accounts?.filter((a) => a.isVerified) ?? []
  const defaultAccount = accounts?.find((a) => a.isDefault) ?? verifiedAccounts[0]

  React.useEffect(() => {
    if (open && defaultAccount && !selectedAccountId) {
      setSelectedAccountId(defaultAccount.id)
    }
  }, [open, defaultAccount, selectedAccountId])

  function onSubmit(values: FormValues) {
    if (values.amount > balance) {
      form.setError("amount", { message: "Amount exceeds your available balance." })
      return
    }
    if (!selectedAccount) {
      return
    }
    withdraw.mutate(
      {
        amount: values.amount,
        bankAccountId: selectedAccount.id,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  function handleAddBankDone() {
    setShowAddBank(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw savings</DialogTitle>
          <DialogDescription>
            Available balance: <span className="font-medium">{formatNaira(balance)}</span>
          </DialogDescription>
        </DialogHeader>

        {showAddBank ? (
          <div className="flex flex-col gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => setShowAddBank(false)}
            >
              ← Back
            </Button>
            <AddBankAccountForm onDone={handleAddBankDone} />
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <FieldGroup>
              <Field>
                <FieldLabel>Amount</FieldLabel>
                <Controller
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <>
                      <InputGroup>
                        <InputGroupAddon align="inline-start">
                          <span aria-hidden="true">₦</span>
                        </InputGroupAddon>
                        <InputGroupInput
                          type="number"
                          inputMode="numeric"
                          min={1}
                          {...field}
                          aria-invalid={!!form.formState.errors.amount}
                        />
                      </InputGroup>
                      <FieldError errors={form.formState.errors.amount ? [form.formState.errors.amount] : []} />
                    </>
                  )}
                />
              </Field>
            </FieldGroup>

            {accountsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Destination account</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowAddBank(true)}
                  >
                    <Plus className="size-3" />
                    Add bank
                  </Button>
                </div>

                {verifiedAccounts.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center">
                    <Building2 className="mx-auto size-8 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No bank accounts yet. Add one to withdraw.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3"
                      onClick={() => setShowAddBank(true)}
                    >
                      <Plus className="size-3" />
                      Add bank account
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {verifiedAccounts.map((account) => (
                      <label
                        key={account.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                          selectedAccountId === account.id
                            ? "border-primary bg-primary/5"
                            : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="bank-account"
                          value={account.id}
                          checked={selectedAccountId === account.id}
                          onChange={() => setSelectedAccountId(account.id)}
                          className="sr-only"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{account.bankName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {account.accountName ?? "—"} · {account.accountNumberMasked}
                          </p>
                        </div>
                        {selectedAccountId === account.id && (
                          <Check className="size-4 shrink-0 text-primary" />
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="tabular-nums">{formatNaira(Number(amount || 0))}</span>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between font-medium">
                <span>To</span>
                <span className="tabular-nums">
                  {selectedAccount
                    ? `${selectedAccount.bankName} ${selectedAccount.accountNumberMasked}`
                    : "Select an account"}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={
                form.formState.isSubmitting ||
                withdraw.isPending ||
                !selectedAccount ||
                !amount ||
                amount <= 0
              }
            >
              {withdraw.isPending ? "Submitting..." : "Submit withdrawal"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
