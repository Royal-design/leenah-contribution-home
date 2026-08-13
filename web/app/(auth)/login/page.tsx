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
import { getGoogleAccessToken } from "@/lib/api/google"

const formSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").min(8, "Password must be at least 8 characters."),
})

type FormValues = z.infer<typeof formSchema>

export default function LoginPage() {
  const router = useRouter()
  const login = useAuthStore((state) => state.login)
  const googleLogin = useAuthStore((state) => state.googleLogin)
  const loading = useAuthStore((state) => state.loading)
  const [googleLoading, setGoogleLoading] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  })

  function redirectToDashboard(user: { role: string }) {
    router.push(user.role === "admin" ? "/admin/dashboard" : "/dashboard")
  }

  async function onSubmit(values: FormValues) {
    try {
      const user = await login(values.email, values.password)
      toast.success(`Welcome back, ${user.firstName}.`)
      redirectToDashboard(user)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in.")
    }
  }

  async function onGoogleSignIn() {
    setGoogleLoading(true)
    try {
      const accessToken = await getGoogleAccessToken()
      const user = await googleLogin(accessToken)
      toast.success(`Welcome back, ${user.firstName}.`)
      redirectToDashboard(user)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in with Google.")
    } finally {
      setGoogleLoading(false)
    }
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

      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={onGoogleSignIn}
        disabled={googleLoading || loading}
        className="gap-2.5"
      >
        <GoogleIcon />
        {googleLoading ? "Connecting to Google…" : "Continue with Google"}
      </Button>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
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

        <div className="flex items-center justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" disabled={form.formState.isSubmitting || loading}>
          {form.formState.isSubmitting || loading ? "Signing in…" : "Sign in"}
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

function GoogleIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}