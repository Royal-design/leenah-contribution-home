"use client"

import * as React from "react"
import { toast } from "sonner"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import * as z from "zod"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const settingsSchema = z.object({
  platformName: z.string().trim().min(2, "Platform name is required."),
  contactEmail: z.string().email("Enter a valid email address."),
  withdrawalFee: z.coerce
    .number({ invalid_type_error: "Enter a valid fee." })
    .int()
    .min(0, "Fee cannot be negative."),
  bankName: z.string().trim().min(2, "Enter the settlement bank."),
  accountName: z.string().trim().min(2, "Enter the account name."),
  accountNumber: z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit account number."),
})

type SettingsValues = z.infer<typeof settingsSchema>

export default function AdminSettingsPage() {
  const [pending, setPending] = React.useState(false)

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      platformName: "LCH Contribution & Savings",
      contactEmail: "support@lch.ng",
      withdrawalFee: 50,
      bankName: "GTBank",
      accountName: "LCH Treasury Account",
      accountNumber: "0123456789",
    },
  })

  function onSubmit(values: SettingsValues) {
    setPending(true)
    setTimeout(() => {
      setPending(false)
      toast.success("Platform settings saved.")
      form.reset(values)
    }, 600)
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Platform settings"
        description="Configure how LCH operates."
      />

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex max-w-3xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Basic platform information.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Platform name</FieldLabel>
                <Controller
                  control={form.control}
                  name="platformName"
                  render={({ field }) => (
                    <>
                      <Input
                        type="text"
                        aria-invalid={!!form.formState.errors.platformName}
                        {...field}
                      />
                      <FieldError errors={form.formState.errors.platformName ? [form.formState.errors.platformName] : []} />
                    </>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel>Support email</FieldLabel>
                <Controller
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <>
                      <Input
                        type="email"
                        aria-invalid={!!form.formState.errors.contactEmail}
                        {...field}
                      />
                      <FieldError errors={form.formState.errors.contactEmail ? [form.formState.errors.contactEmail] : []} />
                    </>
                  )}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fees</CardTitle>
            <CardDescription>Charges applied to transactions.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Withdrawal fee (₦)</FieldLabel>
                <Controller
                  control={form.control}
                  name="withdrawalFee"
                  render={({ field }) => (
                    <>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        aria-invalid={!!form.formState.errors.withdrawalFee}
                        {...field}
                      />
                      <FieldError errors={form.formState.errors.withdrawalFee ? [form.formState.errors.withdrawalFee] : []} />
                      <FieldDescription>
                        A flat fee charged on every successful withdrawal.
                      </FieldDescription>
                    </>
                  )}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settlement account</CardTitle>
            <CardDescription>Where payouts are funded from.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Bank</FieldLabel>
                <Controller
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-invalid={!!form.formState.errors.bankName}>
                          <SelectValue placeholder="Select bank" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GTBank">GTBank</SelectItem>
                          <SelectItem value="Access Bank">Access Bank</SelectItem>
                          <SelectItem value="Zenith Bank">Zenith Bank</SelectItem>
                          <SelectItem value="UBA">UBA</SelectItem>
                          <SelectItem value="First Bank">First Bank</SelectItem>
                        </SelectContent>
                      </Select>
                      <FieldError errors={form.formState.errors.bankName ? [form.formState.errors.bankName] : []} />
                    </>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel>Account name</FieldLabel>
                <Controller
                  control={form.control}
                  name="accountName"
                  render={({ field }) => (
                    <>
                      <Input
                        type="text"
                        aria-invalid={!!form.formState.errors.accountName}
                        {...field}
                      />
                      <FieldError errors={form.formState.errors.accountName ? [form.formState.errors.accountName] : []} />
                    </>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel>Account number</FieldLabel>
                <Controller
                  control={form.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={10}
                        aria-invalid={!!form.formState.errors.accountNumber}
                        {...field}
                      />
                      <FieldError errors={form.formState.errors.accountNumber ? [form.formState.errors.accountNumber] : []} />
                    </>
                  )}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" disabled={form.formState.isSubmitting || pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </div>
  )
}