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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateSupportThread } from "@/hooks/queries/use-support"
import type { SupportCategory } from "@/types"

const categories: Array<{ value: SupportCategory; label: string }> = [
  { value: "general", label: "General question" },
  { value: "account", label: "Account help" },
  { value: "contribution", label: "Contributions" },
  { value: "savings", label: "Savings" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "other", label: "Something else" },
]

const formSchema = z.object({
  subject: z.string().trim().min(3, "Subject must be at least 3 characters."),
  category: z.enum(
    ["general", "account", "contribution", "savings", "withdrawal", "other"],
    { message: "Choose a category." }
  ),
  message: z.string().trim().min(5, "Tell us a bit more."),
})

type FormValues = z.infer<typeof formSchema>

export function NewThreadDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const createThread = useCreateSupportThread()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { subject: "", category: "general", message: "" },
  })

  function onSubmit(values: FormValues) {
    createThread.mutate(values, {
      onSuccess: () => {
        form.reset()
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            Tell us what you need help with and a member of the LCH team will get
            back to you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel>Subject</FieldLabel>
              <Controller
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <>
                    <Input
                      type="text"
                      placeholder="e.g. My withdrawal hasn't arrived"
                      aria-invalid={!!form.formState.errors.subject}
                      {...field}
                    />
                    <FieldError errors={form.formState.errors.subject ? [form.formState.errors.subject] : []} />
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Category</FieldLabel>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-invalid={!!form.formState.errors.category}>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={form.formState.errors.category ? [form.formState.errors.category] : []} />
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Message</FieldLabel>
              <Controller
                control={form.control}
                name="message"
                render={({ field }) => (
                  <>
                    <Textarea
                      rows={5}
                      placeholder="Describe what's going on…"
                      aria-invalid={!!form.formState.errors.message}
                      {...field}
                    />
                    <FieldDescription>
                      Include any reference numbers or dates if relevant.
                    </FieldDescription>
                    <FieldError errors={form.formState.errors.message ? [form.formState.errors.message] : []} />
                  </>
                )}
              />
            </Field>
          </FieldGroup>

          <Button type="submit" size="lg" disabled={createThread.isPending || form.formState.isSubmitting}>
            {createThread.isPending ? "Sending…" : "Send message"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}