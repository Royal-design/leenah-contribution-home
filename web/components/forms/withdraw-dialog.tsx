"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, type Resolver } from "react-hook-form"
import * as z from "zod"
import { Plus, Check, Loader2, Building2, ChevronDownIcon, AlertTriangle, Wallet as WalletIcon, Landmark } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { formatNaira } from "@/lib/format"
import { CommissionBreakdown } from "@/components/shared/commission-breakdown"
import {
  useRequestWithdrawal,
  useWithdrawalPreview,
  useBankAccounts,
  useSaveBankAccount,
  useBanks,
} from "@/hooks/queries/use-wallet"
import { apiResolveBankAccount } from "@/lib/api/wallet"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  amount: z.coerce
    .number({ message: "Enter a valid amount." })
    .int("Amount must be a whole number.")
    .positive("Amount must be greater than zero."),
  reason: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface WithdrawDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  available: number
  title?: string
  subtitle?: string
  mode?: "wallet" | "savings_plan" | "contribution" | "emergency"
  withdrawalType?: "savings" | "contribution"
  source?: "user" | "emergency"
  savingsPlanId?: string
  contributionId?: string
  defaultChannel?: "wallet" | "bank"
}

type Step = "amount" | "destination" | "review"

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
  const filtered = banks.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))

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
  available,
  title = "Withdraw funds",
  subtitle,
  mode = "wallet",
  withdrawalType = "savings",
  source = "user",
  savingsPlanId,
  contributionId,
  defaultChannel = "wallet",
}: WithdrawDialogProps) {
  const { data: accounts, isLoading: accountsLoading } = useBankAccounts()
  const withdraw = useRequestWithdrawal()
  const [showAddBank, setShowAddBank] = React.useState(false)
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(null)
  const [step, setStep] = React.useState<Step>("amount")
  const [channel, setChannel] = React.useState<"wallet" | "bank">(defaultChannel)
  const isEmergency = source === "emergency" || mode === "emergency"

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: { amount: undefined, reason: "" },
  })

  const amount = form.watch("amount")
  const reason = form.watch("reason")
  const previewInput = React.useMemo(
    () =>
      Number(amount) > 0
        ? {
            amount: Math.floor(Number(amount)),
            withdrawalType,
            channel,
            source,
            savingsPlanId,
            contributionId,
          }
        : null,
    [amount, withdrawalType, channel, source, savingsPlanId, contributionId]
  )
  const preview = useWithdrawalPreview(previewInput)

  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId)
  const verifiedAccounts = accounts?.filter((a) => a.isVerified) ?? []
  const defaultAccount = accounts?.find((a) => a.isDefault) ?? verifiedAccounts[0]

  React.useEffect(() => {
    if (open) {
      setStep("amount")
      setChannel(defaultChannel)
      setShowAddBank(false)
      form.reset({ amount: undefined, reason: "" })
    }
  }, [open, defaultChannel, form])

  React.useEffect(() => {
    if (open && defaultAccount && !selectedAccountId) {
      setSelectedAccountId(defaultAccount.id)
    }
  }, [open, defaultAccount, selectedAccountId])

  function onSubmitAmount(values: FormValues) {
    if (values.amount > available) {
      form.setError("amount", { message: "Amount exceeds your available balance." })
      return
    }
    if (isEmergency && (!values.reason || !values.reason.trim())) {
      form.setError("reason", { message: "A reason is required for an emergency request." })
      return
    }
    setStep("destination")
  }

  function canContinueToReview() {
    if (!Number(amount) || Number(amount) > available) return false
    if (isEmergency && !(reason ?? "").trim()) return false
    if (channel === "bank" && !selectedAccount) return false
    return true
  }

  function handleSubmit() {
    withdraw.mutate(
      {
        amount: Math.floor(Number(amount)),
        withdrawalType,
        channel,
        source,
        reason: reason?.trim() || undefined,
        bankAccountId: channel === "bank" ? selectedAccount?.id : undefined,
        savingsPlanId,
        contributionId,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  const destinationLabel =
    channel === "wallet"
      ? "Platform wallet"
      : selectedAccount
        ? `${selectedAccount.bankName} ${selectedAccount.accountNumberMasked}`
        : "Bank account"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {subtitle ?? (
              <>
                Available balance:{" "}
                <span className="font-medium">{formatNaira(available)}</span>
                {isEmergency && (
                  <span className="ml-2 text-warning">Requires admin approval</span>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {(["amount", "destination", "review"] as Step[]).map((s, index) => {
            const labels: Record<Step, string> = {
              amount: "Amount",
              destination: "Destination",
              review: "Review",
            }
            const currentIndex = ["amount", "destination", "review"].indexOf(step)
            return (
              <React.Fragment key={s}>
                {index > 0 && <div className="h-px flex-1 bg-border" />}
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    index <= currentIndex
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {index < currentIndex && <Check className="size-3" />}
                  {labels[s]}
                </span>
              </React.Fragment>
            )
          })}
        </div>

        {isEmergency && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <p className="text-warning-foreground">
              Emergency withdrawals let you access funds before your scheduled
              period, but they are <strong>not guaranteed</strong> — an admin reviews
              and approves each request.
            </p>
          </div>
        )}

        {showAddBank ? (
          <div className="flex flex-col gap-4">
            <Button variant="ghost" size="sm" className="w-fit" onClick={() => setShowAddBank(false)}>
              ← Back
            </Button>
            <AddBankAccountForm
              onDone={() => {
                setShowAddBank(false)
                setSelectedAccountId(null)
              }}
            />
          </div>
        ) : step === "amount" ? (
          <form onSubmit={form.handleSubmit(onSubmitAmount)} className="flex flex-col gap-5">
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

              {isEmergency && (
                <Field>
                  <FieldLabel>Reason</FieldLabel>
                  <Controller
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <>
                        <Textarea
                          rows={3}
                          placeholder="Why do you need this withdrawal?"
                          {...field}
                          aria-invalid={!!form.formState.errors.reason}
                        />
                        <FieldError errors={form.formState.errors.reason ? [form.formState.errors.reason] : []} />
                      </>
                    )}
                  />
                </Field>
              )}

              {Number(amount) > 0 && (
                <CommissionBreakdown
                  gross={Number(amount)}
                  commission={preview.data?.commission}
                  fee={preview.data?.fee}
                  net={preview.data?.net}
                />
              )}
            </FieldGroup>

            <Button type="submit" size="lg" disabled={!Number(amount) || Number(amount) <= 0}>
              Continue
            </Button>
          </form>
        ) : step === "destination" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setStep("review")
            }}
            className="flex flex-col gap-5"
          >
            <FieldGroup>
              <Field>
                <FieldLabel>Destination</FieldLabel>
                <div className="grid gap-2">
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
                      channel === "wallet" && "border-primary bg-primary/5"
                    )}
                  >
                    <input
                      type="radio"
                      name="destination"
                      checked={channel === "wallet"}
                      onChange={() => setChannel("wallet")}
                      className="sr-only"
                    />
                    <span className="flex size-9 items-center justify-center rounded-lg bg-info/15 text-info">
                      <WalletIcon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Platform wallet</p>
                      <p className="text-xs text-muted-foreground">Money stays in your LCH wallet</p>
                    </div>
                    {channel === "wallet" && <Check className="size-4 shrink-0 text-primary" />}
                  </label>

                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
                      channel === "bank" && "border-primary bg-primary/5"
                    )}
                  >
                    <input
                      type="radio"
                      name="destination"
                      checked={channel === "bank"}
                      onChange={() => setChannel("bank")}
                      className="sr-only"
                    />
                    <span className="flex size-9 items-center justify-center rounded-lg bg-success/15 text-success">
                      <Landmark className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Bank account</p>
                      <p className="text-xs text-muted-foreground">
                        Sent to your verified bank account
                      </p>
                    </div>
                    {channel === "bank" && <Check className="size-4 shrink-0 text-primary" />}
                  </label>
                </div>
              </Field>

              {channel === "bank" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Bank account</p>
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

                  {accountsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : verifiedAccounts.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center">
                      <Building2 className="mx-auto size-8 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        No bank accounts yet. Add one to withdraw to a bank.
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
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
                            selectedAccountId === account.id && "border-primary bg-primary/5"
                          )}
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
            </FieldGroup>

            <div className="flex items-center justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep("amount")}>
                ← Back
              </Button>
              <Button type="submit" size="lg" disabled={!canContinueToReview()}>
                Review
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-5">
            <CommissionBreakdown
              gross={Math.floor(Number(amount) || 0)}
              commission={preview.data?.commission}
              fee={preview.data?.fee}
              net={preview.data?.net}
            />

            <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sent to</span>
                <span className="font-medium">{destinationLabel}</span>
              </div>
              {isEmergency && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Reason</span>
                  <span className="max-w-[60%] truncate font-medium">{reason}</span>
                </div>
              )}
              {savingsPlanId && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium">Requires admin approval</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep("destination")}>
                ← Back
              </Button>
              <Button size="lg" onClick={handleSubmit} disabled={withdraw.isPending || !canContinueToReview()}>
                {withdraw.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Submitting…
                  </>
                ) : (
                  "Submit withdrawal request"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}