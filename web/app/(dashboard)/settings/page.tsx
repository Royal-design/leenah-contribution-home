"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { apiChangePassword } from "@/lib/api/auth"

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Za-z]/, "Password must contain a letter.")
      .regex(/[0-9]/, "Password must contain a number."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

type PasswordValues = z.infer<typeof passwordSchema>

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  async function onPasswordSubmit(values: PasswordValues) {
    try {
      await apiChangePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      toast.success("Password updated successfully.")
      passwordForm.reset()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update password.")
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Settings"
        description="Customize your LCH experience."
      />

      <div className="flex max-w-3xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose how LCH looks for you.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={theme ?? "system"}
              onValueChange={(value) => setTheme(value)}
              className="flex flex-col gap-3 sm:flex-row sm:gap-6"
            >
              <label className="flex items-center gap-2.5">
                <RadioGroupItem value="light" />
                <span className="text-sm">Light</span>
              </label>
              <label className="flex items-center gap-2.5">
                <RadioGroupItem value="dark" />
                <span className="text-sm">Dark</span>
              </label>
              <label className="flex items-center gap-2.5">
                <RadioGroupItem value="system" />
                <span className="text-sm">System</span>
              </label>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>
              Use at least 8 characters with a letter and a number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
              className="flex flex-col gap-5"
            >
              <FieldGroup>
                <Field>
                  <FieldLabel>Current password</FieldLabel>
                  <Controller
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          aria-invalid={!!passwordForm.formState.errors.currentPassword}
                          {...field}
                        />
                        <FieldError errors={passwordForm.formState.errors.currentPassword ? [passwordForm.formState.errors.currentPassword] : []} />
                      </>
                    )}
                  />
                </Field>
                <Field>
                  <FieldLabel>New password</FieldLabel>
                  <Controller
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          aria-invalid={!!passwordForm.formState.errors.newPassword}
                          {...field}
                        />
                        <FieldError errors={passwordForm.formState.errors.newPassword ? [passwordForm.formState.errors.newPassword] : []} />
                      </>
                    )}
                  />
                </Field>
                <Field>
                  <FieldLabel>Confirm new password</FieldLabel>
                  <Controller
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          aria-invalid={!!passwordForm.formState.errors.confirmPassword}
                          {...field}
                        />
                        <FieldError errors={passwordForm.formState.errors.confirmPassword ? [passwordForm.formState.errors.confirmPassword] : []} />
                      </>
                    )}
                  />
                </Field>
              </FieldGroup>
              <Button
                type="submit"
                size="lg"
                disabled={passwordForm.formState.isSubmitting}
              >
                {passwordForm.formState.isSubmitting ? "Updating…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Keep your account protected.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-border">
            <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
              <div>
                <p className="text-sm font-medium">Two-factor authentication</p>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account.
                </p>
              </div>
              <Button variant="outline" size="sm">
                Enable
              </Button>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
              <div>
                <p className="text-sm font-medium">Active sessions</p>
                <p className="text-sm text-muted-foreground">
                  Manage devices signed into LCH.
                </p>
              </div>
              <Button variant="outline" size="sm">
                Review
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}