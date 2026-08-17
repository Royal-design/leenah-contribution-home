"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, type Resolver } from "react-hook-form"
import * as z from "zod"
import { Copy, Check, Building2, CreditCard, Loader2, RefreshCw } from "lucide-react"

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
  FieldLabel,
} from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { formatNaira } from "@/lib/format"
import { apiInitializeCardFunding, apiVerifyCardFunding } from "@/lib/api/wallet"
import { useDVA, useCreateDVA, useRequeryDVA } from "@/hooks/queries/use-wallet"
import { useSavings } from "@/hooks/queries/use-savings"

const cardSchema = z.object({
  amount: z.coerce
    .number({ message: "Enter a valid amount." })
    .int("Amount must be a whole number.")
    .positive("Amount must be greater than zero.")
    .max(5000000, "Maximum funding amount is ₦5,000,000."),
})

type CardFormValues = z.infer<typeof cardSchema>

function CardFundingTab() {
  const [processing, setProcessing] = React.useState(false)

  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema) as Resolver<CardFormValues>,
    defaultValues: { amount: 10000 },
  })

  const amount = form.watch("amount")

  async function handlePay() {
    const valid = await form.trigger()
    if (!valid) return

    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? ""
    if (!publicKey) {
      toast.error("Payment is not configured. Please contact support.")
      return
    }

    setProcessing(true)
    try {
      const { authorizationUrl } = await apiInitializeCardFunding({
        amount,
        callbackUrl: `${window.location.origin}/wallet`,
      })

      if (!authorizationUrl) {
        toast.error("Could not initialize payment.")
        setProcessing(false)
        return
      }

      window.location.href = authorizationUrl
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to initialize payment.")
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="card-amount">Amount</FieldLabel>
        <Controller
          control={form.control}
          name="amount"
          render={({ field }) => (
            <InputGroup>
              <InputGroupAddon align="inline-start">
                <span aria-hidden="true">₦</span>
              </InputGroupAddon>
              <InputGroupInput
                id="card-amount"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="0"
                {...field}
                aria-invalid={!!form.formState.errors.amount}
              />
            </InputGroup>
          )}
        />
        <FieldError errors={form.formState.errors.amount ? [form.formState.errors.amount] : []} />
      </Field>

      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        You'll be redirected to Paystack's secure checkout to complete payment with your card.
      </div>

      <Button
        type="button"
        size="lg"
        disabled={processing}
        onClick={handlePay}
      >
        {processing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CreditCard className="size-4" />
        )}
        {processing ? "Redirecting..." : `Pay ${formatNaira(amount || 0)}`}
      </Button>
    </div>
  )
}

function BankTransferTab() {
  const { data: dva, isLoading } = useDVA()
  const createDVA = useCreateDVA()
  const requeryDVA = useRequeryDVA()
  const [copied, setCopied] = React.useState<"account" | "name" | null>(null)

  function copyToClipboard(text: string, field: "account" | "name") {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!dva) {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <Building2 className="size-10 text-muted-foreground" />
        <p className="text-center text-sm text-muted-foreground">
          Create a virtual account to fund your wallet via bank transfer.
        </p>
        <Button
          onClick={() => createDVA.mutate()}
          disabled={createDVA.isPending}
        >
          {createDVA.isPending && <Loader2 className="size-4 animate-spin" />}
          Create Virtual Account
        </Button>
      </div>
    )
  }

  if (dva.status === "pending") {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <Loader2 className="size-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-sm font-medium">Account is being set up</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This usually takes a few minutes. You can check the status or wait for a notification.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => requeryDVA.mutate()}
            disabled={requeryDVA.isPending}
          >
            <RefreshCw className={`size-3.5 ${requeryDVA.isPending ? "animate-spin" : ""}`} />
            Check status
          </Button>
        </div>
        {dva.accountNumber && (
          <div className="w-full rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Account details (may become active soon)</p>
            <div className="mt-2 space-y-1.5 text-sm">
              <DetailRow label="Bank" value={dva.bankName ?? "Paystack-Titan"} />
              <DetailRow label="Account name" value={dva.accountName ?? "—"} />
              <DetailRow label="Account number" value={dva.accountNumber} />
            </div>
          </div>
        )}
      </div>
    )
  }

  if (dva.status === "failed") {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <Building2 className="size-10 text-destructive" />
        <p className="text-center text-sm text-muted-foreground">
          Virtual account setup failed. Please try again.
        </p>
        <Button onClick={() => createDVA.mutate()} disabled={createDVA.isPending}>
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground">Fund your wallet</p>
        <div className="mt-3 space-y-3">
          <DetailRow label="Bank" value={dva.bankName ?? "Paystack-Titan"} />
          <DetailRow
            label="Account name"
            value={dva.accountName ?? "—"}
            onCopy={
              dva.accountName
                ? () => copyToClipboard(dva.accountName!, "name")
                : undefined
            }
            copied={copied === "name"}
          />
          <DetailRow
            label="Account number"
            value={dva.accountNumber ?? "—"}
            onCopy={
              dva.accountNumber
                ? () => copyToClipboard(dva.accountNumber!, "account")
                : undefined
            }
            copied={copied === "account"}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Transfer money from your bank account to this account. Your wallet will
        be credited after the transfer is confirmed.
      </p>

      <Badge variant="outline" className="w-fit text-xs">
        Status: {dva.status}
      </Badge>
    </div>
  )
}

function DetailRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string
  value: string
  onCopy?: () => void
  copied?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium tabular-nums">{value}</p>
      </div>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
        </button>
      )}
    </div>
  )
}

const methods = [
  { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
  { value: "card", label: "Pay with Card", icon: CreditCard },
]

export function FundingDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [method, setMethod] = React.useState<"card" | "bank_transfer">("bank_transfer")
  const { refetch: refetchSavings } = useSavings()

  function handleSuccess() {
    refetchSavings()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Money</DialogTitle>
          <DialogDescription>Fund your LCH wallet.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <RadioGroup
            value={method}
            onValueChange={(v) => setMethod(v as "card" | "bank_transfer")}
            className="grid grid-cols-2 gap-2"
          >
            {methods.map((m) => (
              <label
                key={m.value}
                className="flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary/5"
              >
                <RadioGroupItem value={m.value} />
                <m.icon className="size-4 text-muted-foreground" />
                <span>{m.label}</span>
              </label>
            ))}
          </RadioGroup>

          <Separator />

          {method === "card" ? (
            <CardFundingTab />
          ) : (
            <BankTransferTab />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
