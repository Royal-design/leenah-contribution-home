"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"
import { Camera, IdCard, ShieldCheck, Mail, Phone, Trash2, UserRound } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Avatar, AvatarFallback, AvatarImage, AvatarBadge } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
import { apiUpdateAvatar } from "@/lib/api/users"
import { apiUpdateProfile } from "@/lib/api/auth"
import { formatDate, getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"

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

const statusTone: Record<string, string> = {
  active: "border-transparent bg-success/15 text-success dark:bg-success/20",
  suspended: "border-transparent bg-warning/15 text-warning dark:bg-warning/20",
  invited: "border-transparent bg-info/15 text-info dark:bg-info/25",
}

export default function ProfilePage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const deleteAccount = useAuthStore((state) => state.deleteAccount)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
    },
  })

  async function onSubmit(values: FormValues) {
    try {
      const updated = await apiUpdateProfile({
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
      })
      setUser(updated)
      toast.success("Profile updated successfully.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update profile.")
    }
  }

  async function onPhotoPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.")
      return
    }

    try {
      const updated = await apiUpdateAvatar(file)
      setUser(updated)
      toast.success("Profile photo updated.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update profile photo.")
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
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
        <Card className="overflow-hidden lg:col-span-3">
          <CardContent className="relative">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative shrink-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-full"
                  aria-label="Change profile photo"
                >
                  <Avatar size="lg" className="size-28 shadow-lg ring-4 ring-background">
                    <AvatarImage src={user.photo} alt={`${user.firstName} ${user.lastName}`} />
                    <AvatarFallback className="text-2xl">
                      {getInitials(user.firstName, user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <AvatarBadge className="size-6 translate-x-2 translate-y-2">
                    <Camera className="size-3" aria-hidden="true" />
                  </AvatarBadge>
                </button>

                <div className="flex flex-col gap-1 pb-1">
                  <h2 className="font-heading text-2xl font-semibold tracking-tight">
                    {user.firstName} {user.lastName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="capitalize font-medium">
                      <ShieldCheck className="mr-1 size-3" aria-hidden="true" />
                      {user.role}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn("font-medium capitalize", statusTone[user.status])}
                    >
                      {user.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera />
                Change photo
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPhotoPicked}
            />

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Mail className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="truncate text-sm font-medium">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Phone className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="truncate text-sm font-medium">{user.phone || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IdCard className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Member since</p>
                  <p className="truncate text-sm font-medium">{formatDate(user.joinedAt)}</p>
                </div>
              </div>
            </div>
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

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                  <UserRound className="size-4" aria-hidden="true" />
                </span>
                Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Member since</dt>
                  <dd className="text-right font-medium">{formatDate(user.joinedAt)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Account role</dt>
                  <dd className="font-medium capitalize">{user.role}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Account status</dt>
                  <dd className="font-medium capitalize">{user.status}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Danger zone</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:w-full">
                  <div>
                    <p className="text-sm font-medium">Delete account</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Permanently remove your account and all data.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
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