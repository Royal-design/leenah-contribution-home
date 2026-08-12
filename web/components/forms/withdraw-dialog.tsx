"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, type Resolver } from "react-hook-form"
import * as z from "zod"

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
import { useWithdrawSavings } from "@/hooks/queries/use-savings"

const formSchema = z.object({
  amount: z.coerce
    .number({ message: "Enter a valid amount." })
    .int("Amount must be a whole number.")
    .positive("Amount must be greater than zero."),
  bankName: z.string().trim().min(2, "Enter your bank name."),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a valid 10-digit account number."),
})

type FormValues = z.infer<typeof formSchema>

export function WithdrawDialog({
  open,
  onOpenChange,
  balance,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  balance: number
}) {
  const withdrawSavings = useWithdrawSavings()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: { amount: undefined, bankName: "", accountNumber: "" },
  })

  const amount = form.watch("amount")
  const fee = 50
  const received = Math.max(0, Number(amount || 0) - fee)

  function onSubmit(values: FormValues) {
    if (values.amount > balance) {
      form.setError("amount", {
        message: "Amount exceeds your available balance.",
      })
      return
    }
    withdrawSavings.mutate(
      {
        amount: values.amount,
        destination: `${values.bankName} ${values.accountNumber}`,
        bankName: values.bankName,
        accountNumber: values.accountNumber,
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    )
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

            <Field>
              <FieldLabel>Destination bank</FieldLabel>
              <Controller
                control={form.control}
                name="bankName"
                render={({ field }) => (
                  <>
                    <InputGroup>
                      <InputGroupInput
                        type="text"
                        placeholder="e.g. GTBank"
                        autoComplete="off"
                        {...field}
                        aria-invalid={!!form.formState.errors.bankName}
                      />
                    </InputGroup>
                    <FieldError errors={form.formState.errors.bankName ? [form.formState.errors.bankName] : []} />
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Account number</FieldLabel>
              <Controller
                control={form.control}
                name="accountNumber"
                render={({ field }) => (
                  <>
                    <InputGroup>
                      <InputGroupInput
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="0000000000"
                        {...field}
                        aria-invalid={!!form.formState.errors.accountNumber}
                      />
                    </InputGroup>
                    <FieldError errors={form.formState.errors.accountNumber ? [form.formState.errors.accountNumber] : []} />
                  </>
                )}
              />
            </Field>
          </FieldGroup>

          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="tabular-nums">{formatNaira(Number(amount || 0))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Withdrawal fee</span>
              <span className="tabular-nums">{formatNaira(fee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bank</span>
              <span className="tabular-nums">
                {form.watch("bankName") || "—"}
              </span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between font-medium">
              <span>You&apos;ll receive</span>
              <span className="tabular-nums">{formatNaira(received)}</span>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting || withdrawSavings.isPending}
          >
            {form.formState.isSubmitting || withdrawSavings.isPending
              ? "Submitting…"
              : "Submit withdrawal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}