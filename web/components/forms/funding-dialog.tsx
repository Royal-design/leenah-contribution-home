"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { formatNaira } from "@/lib/format"
import { useFundSavings } from "@/hooks/queries/use-savings"

const methods = [
  { value: "Card", label: "Card" },
  { value: "Bank Transfer", label: "Bank Transfer" },
  { value: "Wallet", label: "Wallet" },
]

const formSchema = z.object({
  amount: z.coerce
    .number("Enter a valid amount.")
    .int("Amount must be a whole number.")
    .positive("Amount must be greater than zero.")
    .max(5000000, "Maximum funding amount is ₦5,000,000."),
  method: z.enum(["Card", "Bank Transfer", "Wallet"], "Select a funding method."),
})

type FormValues = z.infer<typeof formSchema>

export function FundingDialog({
  open,
  onOpenChange,
  goalId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalId?: string
}) {
  const fundSavings = useFundSavings()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: 10000, method: "Card" },
  })

  const amount = form.watch("amount")
  const fee = 0
  const total = Number(amount || 0) + fee

  function onSubmit(values: FormValues) {
    fundSavings.mutate(
      { goalId, amount: values.amount, method: values.method },
      {
        onSuccess: () => onOpenChange(false),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Money</DialogTitle>
          <DialogDescription>Fund your LCH savings wallet.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="fund-amount">Amount</FieldLabel>
              <Controller
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <span aria-hidden="true">₦</span>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="fund-amount"
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

            <Field>
              <FieldLabel id="fund-method-label">Funding method</FieldLabel>
              <Controller
                control={form.control}
                name="method"
                render={({ field }) => (
                  <Field>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      aria-labelledby="fund-method-label"
                      className="grid gap-2"
                    >
                      {methods.map((method) => (
                        <label key={method.value} className="flex items-center gap-2.5">
                          <RadioGroupItem value={method.value} />
                          <span className="text-sm">{method.label}</span>
                        </label>
                      ))}
                    </RadioGroup>
                    <FieldDescription>
                      Mock funding only — no payment provider connected yet.
                    </FieldDescription>
                    <FieldError errors={form.formState.errors.method ? [form.formState.errors.method] : []} />
                  </Field>
                )}
              />
            </Field>
          </FieldGroup>

          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="tabular-nums">{formatNaira(amount || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fee</span>
              <span className="tabular-nums">{formatNaira(fee)}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatNaira(total)}</span>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting || fundSavings.isPending}
          >
            {form.formState.isSubmitting || fundSavings.isPending
              ? "Processing…"
              : `Fund ${formatNaira(total)}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}