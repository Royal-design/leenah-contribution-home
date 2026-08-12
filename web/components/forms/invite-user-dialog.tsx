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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useInviteUser } from "@/hooks/queries/use-admin"
import type { Role } from "@/types"

const inviteSchema = z.object({
  firstName: z.string().trim().min(2, "Enter a first name."),
  lastName: z.string().trim().min(2, "Enter a last name."),
  email: z.string().trim().min(1, "Enter an email address.").email("Enter a valid email address."),
  role: z.enum(["user", "admin"], "Select a role."),
})

type InviteValues = z.infer<typeof inviteSchema>

export function InviteUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const inviteUser = useInviteUser()

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      role: "user",
    },
  })

  function onSubmit(values: InviteValues) {
    inviteUser.mutate(values, {
      onSuccess: () => {
        form.reset()
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            They&apos;ll receive an invite to join the platform.
          </DialogDescription>
        </DialogHeader>

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
                      placeholder="they@example.com"
                      aria-invalid={!!form.formState.errors.email}
                      {...field}
                    />
                    <FieldError errors={form.formState.errors.email ? [form.formState.errors.email] : []} />
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Role</FieldLabel>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <>
                    <Select value={field.value} onValueChange={(value) => field.onChange(value as Role)}>
                      <SelectTrigger aria-invalid={!!form.formState.errors.role}>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError errors={form.formState.errors.role ? [form.formState.errors.role] : []} />
                    <FieldDescription>
                      Admins get access to the admin dashboard.
                    </FieldDescription>
                  </>
                )}
              />
            </Field>
          </FieldGroup>

          <Button type="submit" size="lg" disabled={inviteUser.isPending || form.formState.isSubmitting}>
            {inviteUser.isPending ? "Sending…" : "Send invite"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}