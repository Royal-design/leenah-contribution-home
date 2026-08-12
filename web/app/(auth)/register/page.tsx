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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAuthStore } from "@/stores/auth-store"

const formSchema = z.object({
  firstName: z.string().trim().min(2, "Enter your first name."),
  lastName: z.string().trim().min(2, "Enter your last name."),
  email: z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .min(1, "Enter your phone number.")
    .regex(/^\+?[0-9\s-]{10,15}$/, "Enter a valid phone number."),
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

export default function RegisterPage() {
  const router = useRouter()
  const register = useAuthStore((state) => state.register)
  const loading = useAuthStore((state) => state.loading)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  })

  async function onSubmit(values: FormValues) {
    try {
      const user = await register({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        password: values.password,
      })
      toast.success(`Welcome to LCH, ${user.firstName}.`)
      router.push("/dashboard")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create account.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Start contributing and saving on LCH.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <FieldGroup>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel>First name</FieldLabel>
              <Controller
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <>
                    <Input
                      type="text"
                      autoComplete="given-name"
                      placeholder="Ngozi"
                      aria-invalid={!!form.formState.errors.firstName}
                      {...field}
                    />
                    <FieldError errors={form.formState.errors.firstName ? [form.formState.errors.firstName] : []} />
                  </>
                )}
              />
            </Field>
            <Field>
              <FieldLabel>Last name</FieldLabel>
              <Controller
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <>
                    <Input
                      type="text"
                      autoComplete="family-name"
                      placeholder="Eze"
                      aria-invalid={!!form.formState.errors.lastName}
                      {...field}
                    />
                    <FieldError errors={form.formState.errors.lastName ? [form.formState.errors.lastName] : []} />
                  </>
                )}
              />
            </Field>
          </div>

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
            <FieldLabel>Phone number</FieldLabel>
            <Controller
              control={form.control}
              name="phone"
              render={({ field }) => (
                <>
                  <Input
                    type="tel"
                    autoComplete="tel"
                    placeholder="+234 800 000 0000"
                    aria-invalid={!!form.formState.errors.phone}
                    {...field}
                  />
                  <FieldError errors={form.formState.errors.phone ? [form.formState.errors.phone] : []} />
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
            <FieldLabel>Confirm password</FieldLabel>
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

        <Button type="submit" size="lg" disabled={form.formState.isSubmitting || loading}>
          {form.formState.isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}