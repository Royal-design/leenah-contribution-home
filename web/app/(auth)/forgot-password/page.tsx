"use client"

import * as React from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { apiRequestPasswordReset } from "@/lib/api/auth"

const formSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address."),
})

type FormValues = z.infer<typeof formSchema>

export default function ForgotPasswordPage() {
  const [sent, setSent] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    try {
      await apiRequestPasswordReset(values.email)
      setSent(true)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Check your inbox
        </h1>
        <p className="text-sm text-muted-foreground">
          We sent a password reset link to your email address. The link expires
          in 30 minutes.
        </p>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          Return to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Reset your password
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Enter your account email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <FieldGroup>
          <Field>
            <FieldLabel>Email address</FieldLabel>
            <Controller
              control={form.control}
              name="email"
              render={({ field }) => (
                <>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-invalid={!!form.formState.errors.email}
                    {...field}
                  />
                  <FieldError errors={form.formState.errors.email ? [form.formState.errors.email] : []} />
                </>
              )}
            />
          </Field>
        </FieldGroup>

        <Button type="submit" size="lg" disabled={form.formState.isSubmitting || submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remembered your password?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}