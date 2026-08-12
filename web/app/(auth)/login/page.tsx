"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
import { useAuthStore } from "@/stores/auth-store"
import { findUserByEmail } from "@/lib/mock/users"

const formSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").min(8, "Password must be at least 8 characters."),
})

type FormValues = z.infer<typeof formSchema>

export default function LoginPage() {
  const router = useRouter()
  const login = useAuthStore((state) => state.login)
  const loading = useAuthStore((state) => state.loading)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "chiamaka@lch.ng", password: "password123" },
  })

  async function onSubmit(values: FormValues) {
    try {
      const user = await login(values.email, values.password)
      toast.success(`Welcome back, ${user.firstName}.`)
      router.push(user.role === "admin" ? "/admin/dashboard" : "/dashboard")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.")
    }
  }

  function fillDemo() {
    form.setValue("email", "chiamaka@lch.ng", { shouldValidate: true })
    form.setValue("password", "password123", { shouldValidate: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in to continue to your LCH account.
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

          <Field>
            <FieldLabel>Password</FieldLabel>
            <Controller
              control={form.control}
              name="password"
              render={({ field }) => (
                <>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-invalid={!!form.formState.errors.password}
                    {...field}
                  />
                  <FieldError errors={form.formState.errors.password ? [form.formState.errors.password] : []} />
                </>
              )}
            />
          </Field>
        </FieldGroup>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={fillDemo}
            className="text-sm font-medium text-primary hover:underline"
          >
            Use demo account
          </button>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" disabled={form.formState.isSubmitting || loading}>
          {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </div>
  )
}