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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { formatNaira } from "@/lib/format"
import { useFundContribution } from "@/hooks/queries/use-contributions"
import type { Contribution } from "@/types"

const formSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Enter a valid amount." })
    .int("Amount must be a whole number.")
    .positive("Amount must be greater than zero.")
})

type FormValues = z.infer<typeof formSchema>

export function FundContributionDialog({
  open,
  onOpenChange,
  contribution,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contribution: Contribution
}) {
  const fundContribution = useFundContribution()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: contribution.amount },
  })

  const amount = form.watch("amount")

  function onSubmit(values: FormValues) {
    fundContribution.mutate(
      { id: contribution.id, amount: values.amount },
      {
        onSuccess: () => onOpenChange(false),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay contribution</DialogTitle>
          <DialogDescription>
            Fund your {contribution.name} contribution.
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
          </FieldGroup>

          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="tabular-nums">{formatNaira(amount || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fee</span>
              <span className="tabular-nums">₦0</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatNaira(amount || 0)}</span>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting || fundContribution.isPending}
          >
            {form.formState.isSubmitting || fundContribution.isPending
              ? "Paying…"
              : `Pay ${formatNaira(amount || 0)}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}