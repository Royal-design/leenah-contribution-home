"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useAuthStore } from "@/stores/auth-store"
import { formatDate, getInitials } from "@/lib/format"

const formSchema = z.object({
  firstName: z.string().trim().min(2, "Enter your first name."),
  lastName: z.string().trim().min(2, "Enter your last name."),
  email: z.string().trim().min(1, "Enter your email address.").email("Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .min(1, "Enter your phone number.")
    .regex(/^\+?[0-9\s-]{10,15}$/, "Enter a valid phone number."),
})

type FormValues = z.infer<typeof formSchema>

export default function ProfilePage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const deleteAccount = useAuthStore((state) => state.deleteAccount)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
    },
  })

  function onSubmit(values: FormValues) {
    if (!user) return
    setUser({ ...user, ...values })
    toast.success("Profile updated successfully.")
  }

  async function onConfirmDelete() {
    setDeleting(true)
    try {
      await deleteAccount()
      toast.success("Your account has been deleted.")
      router.replace("/login")
    } catch (error) {
      setDeleting(false)
      toast.error(error instanceof Error ? error.message : "Could not delete account.")
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Profile"
        description="Manage your personal information."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile picture</CardTitle>
            <CardDescription>This is how others see you.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Avatar size="lg">
              <AvatarImage
                src={user.avatar}
                alt={`${user.firstName} ${user.lastName}`}
                width={40}
                height={40}
              />
              <AvatarFallback>
                {getInitials(user.firstName, user.lastName)}
              </AvatarFallback>
            </Avatar>
            <p className="text-center text-sm">
              <span className="font-medium">
                {user.firstName} {user.lastName}
              </span>
            </p>
            <Button variant="outline" size="sm">
              Change photo
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
            <CardDescription>Update your personal details.</CardDescription>
          </CardHeader>
          <CardContent>
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
                          aria-invalid={!!form.formState.errors.email}
                          {...field}
                        />
                        <FieldError errors={form.formState.errors.email ? [form.formState.errors.email] : []} />
                        <FieldDescription>
                          Used for login and account notifications.
                        </FieldDescription>
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
                          aria-invalid={!!form.formState.errors.phone}
                          {...field}
                        />
                        <FieldError errors={form.formState.errors.phone ? [form.formState.errors.phone] : []} />
                      </>
                    )}
                  />
                </Field>
              </FieldGroup>

              <Button
                type="submit"
                size="lg"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Account information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Member since</dt>
                <dd className="font-medium">{formatDate(user.joinedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Account role</dt>
                <dd className="font-medium capitalize">{user.role}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Account status</dt>
                <dd className="font-medium capitalize">{user.status}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Irreversible actions on your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Delete account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently remove your account and all associated data.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 />
                Delete account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete your account?"
        description="This permanently deletes your account, contributions, savings, and transaction history. This action cannot be undone."
        confirmLabel="Delete account"
        destructive
        loading={deleting}
        onConfirm={onConfirmDelete}
      />
    </div>
  )
}