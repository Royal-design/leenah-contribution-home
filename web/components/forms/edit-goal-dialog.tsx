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
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { useUpdateSavingsGoal } from "@/hooks/queries/use-savings"
import type { SavingsGoal } from "@/types"

const formSchema = z.object({
  name: z.string().trim().min(3, "Goal name must be at least 3 characters."),
  target: z.coerce
    .number({ message: "Enter a valid target." })
    .int("Target must be a whole number.")
    .positive("Target must be greater than zero."),
  targetDate: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export function EditGoalDialog({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: SavingsGoal | null
}) {
  const updateGoal = useUpdateSavingsGoal()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    values: {
      name: goal?.name ?? "",
      target: goal?.target ?? 0,
      targetDate: goal?.targetDate ? goal.targetDate.slice(0, 10) : "",
    },
  })

  function onSubmit(values: FormValues) {
    if (!goal) return
    updateGoal.mutate(
      {
        id: goal.id,
        payload: {
          name: values.name,
          target: values.target,
          targetDate: values.targetDate || undefined,
        },
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
          <DialogTitle>Edit savings goal</DialogTitle>
          <DialogDescription>Update your goal&apos;s name or target.</DialogDescription>
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
          </FieldGroup>

          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting || updateGoal.isPending}
          >
            {form.formState.isSubmitting || updateGoal.isPending
              ? "Saving…"
              : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}