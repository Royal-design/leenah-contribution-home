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
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { useCreateSavingsGoal } from "@/hooks/queries/use-savings"

const formSchema = z.object({
  name: z.string().trim().min(3, "Goal name must be at least 3 characters."),
  target: z.coerce
    .number({ message: "Enter a valid target." })
    .int("Target must be a whole number.")
    .positive("Target must be greater than zero."),
  targetDate: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export function CreateGoalDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createGoal = useCreateSavingsGoal()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", target: undefined, targetDate: "" },
  })

  function onSubmit(values: FormValues) {
    createGoal.mutate(
      {
        name: values.name,
        target: values.target,
        targetDate: values.targetDate || undefined,
      },
      {
        onSuccess: () => onOpenChange(false),
        onSettled: () => form.reset(),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New savings goal</DialogTitle>
          <DialogDescription>Give your goal a name and target.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel>Goal name</FieldLabel>
              <Controller
                control={form.control}
                name="name"
                render={({ field }) => (
                  <>
                    <Input
                      type="text"
                      placeholder="e.g. Vacation fund"
                      {...field}
                      aria-invalid={!!form.formState.errors.name}
                    />
                    <FieldError errors={form.formState.errors.name ? [form.formState.errors.name] : []} />
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Target amount</FieldLabel>
              <Controller
                control={form.control}
                name="target"
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
                        placeholder="0"
                        {...field}
                        aria-invalid={!!form.formState.errors.target}
                      />
                    </InputGroup>
                    <FieldError errors={form.formState.errors.target ? [form.formState.errors.target] : []} />
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Target date (optional)</FieldLabel>
              <Controller
                control={form.control}
                name="targetDate"
                render={({ field }) => (
                  <>
                    <Input
                      type="date"
                      {...field}
                      aria-invalid={!!form.formState.errors.targetDate}
                    />
                    <FieldDescription>When do you plan to reach this goal?</FieldDescription>
                    <FieldError errors={form.formState.errors.targetDate ? [form.formState.errors.targetDate] : []} />
                  </>
                )}
              />
            </Field>
          </FieldGroup>

          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting || createGoal.isPending}
          >
            {form.formState.isSubmitting || createGoal.isPending
              ? "Creating…"
              : "Create goal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}