"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const formSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Za-z]/, "Password must contain a letter.")
    .regex(/[0-9]/, "Password must contain a number."),
  confirmPassword: z.string().min(1, "Confirm your password."),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
})

type FormValues = z.infer<typeof formSchema>

export default function ResetPasswordPage() {
  return (
    <React.Suspense>
      <ResetPasswordForm />
    </React.Suspense>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  function onSubmit() {
    toast.success("Your password has been reset.")
    router.push("/login")
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Choose a new password
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {token
            ? "Set a strong password for your LCH account."
            : "Invalid or expired reset link. Please request a new one."}
        </p>
      </div>

      {!token ? (
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          Request a new reset link
        </Link>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel>New password</FieldLabel>
              <Controller
                control={form.control}
                name="password"
                render={({ field }) => (
                  <>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      aria-invalid={!!form.formState.errors.password}
                      {...field}
                    />
                    <FieldError errors={form.formState.errors.password ? [form.formState.errors.password] : []} />
                    <FieldDescription>
                      Use at least 8 characters with a letter and a number.
                    </FieldDescription>
                  </>
                )}
              />
            </Field>
            <Field>
              <FieldLabel>Confirm new password</FieldLabel>
              <Controller
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      aria-invalid={!!form.formState.errors.confirmPassword}
                      {...field}
                    />
                    <FieldError errors={form.formState.errors.confirmPassword ? [form.formState.errors.confirmPassword] : []} />
                  </>
                )}
              />
            </Field>
          </FieldGroup>

          <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
            Reset password
          </Button>
        </form>
      )}
    </div>
  )
}