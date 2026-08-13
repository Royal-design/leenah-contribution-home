"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, type Resolver } from "react-hook-form"
import * as z from "zod"
import { Send, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdminUsers, useSendBroadcastMessage, useSendDirectMessage } from "@/hooks/queries/use-admin"
import { getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { User } from "@/types"

const messageSchema = z.object({
  recipient: z.enum(["all", "user"], { message: "Choose who to message." }),
  userId: z.string().optional(),
  title: z.string().trim().min(1, "Add a subject.").max(120),
  message: z.string().trim().min(1, "Write a message.").max(2000),
})

type MessageValues = z.infer<typeof messageSchema>

export function SendMessageDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const broadcast = useSendBroadcastMessage()
  const direct = useSendDirectMessage()

  const { data: users, isPending } = useAdminUsers({
    page: 1,
    pageSize: 15,
    search: debouncedSearch || undefined,
  })

  const form = useForm<MessageValues>({
    resolver: zodResolver(messageSchema) as Resolver<MessageValues>,
    defaultValues: {
      recipient: "all",
      userId: "",
      title: "",
      message: "",
    },
  })

  const recipient = form.watch("recipient")
  const selectedUserId = form.watch("userId")
  const selectedUser = (users?.items ?? []).find((user) => user.id === selectedUserId)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  React.useEffect(() => {
    if (recipient === "all") {
      form.setValue("userId", "")
    }
  }, [recipient, form])

  const isPendingSend = broadcast.isPending || direct.isPending

  function onSubmit(values: MessageValues) {
    const base = {
      title: values.title,
      message: values.message,
    }
    if (values.recipient === "all") {
      broadcast.mutate(base, {
        onSuccess: () => {
          form.reset()
          onOpenChange(false)
        },
      })
    } else if (values.userId) {
      direct.mutate(
        { ...base, userId: values.userId },
        {
          onSuccess: () => {
            form.reset()
            onOpenChange(false)
          },
        }
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send a message</DialogTitle>
          <DialogDescription>
            Message all users or a single user. They will see it in their notifications.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel>Recipients</FieldLabel>
              <Controller
                control={form.control}
                name="recipient"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={!!form.formState.errors.recipient}>
                      <SelectValue placeholder="Choose recipients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All users</SelectItem>
                      <SelectItem value="user">A specific user</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            {recipient === "user" && (
              <Field>
                <FieldLabel>User</FieldLabel>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    placeholder="Search users by name or email…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="pl-8"
                    aria-label="Search users"
                  />
                </div>

                <div className="flex max-h-56 flex-col overflow-y-auto rounded-lg border">
                  {isPending ? (
                    <div className="flex flex-col gap-2 p-2">
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="h-10 w-full rounded-md" />
                      <Skeleton className="h-10 w-full rounded-md" />
                    </div>
                  ) : (users?.items ?? []).length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No users found.
                    </p>
                  ) : (
                    (users?.items ?? []).map((user: User) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => form.setValue("userId", user.id)}
                        className={cn(
                          "flex items-center gap-3 border-b px-3 py-2.5 text-left text-sm last:border-0 hover:bg-muted/50",
                          selectedUserId === user.id && "bg-primary/10"
                        )}
                      >
                        <Avatar size="sm">
                          <AvatarFallback>
                            {getInitials(`${user.firstName} ${user.lastName}`)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                {selectedUser && (
                  <p className="text-xs text-muted-foreground">
                    Sending to <span className="font-medium text-foreground">{selectedUser.firstName} {selectedUser.lastName}</span>.
                  </p>
                )}
                {form.formState.errors.userId && (
                  <FieldError errors={[form.formState.errors.userId]} />
                )}
              </Field>
            )}
          </FieldGroup>

          <FieldGroup>
            <Field>
              <FieldLabel>Subject</FieldLabel>
              <Controller
                control={form.control}
                name="title"
                render={({ field }) => (
                  <>
                    <Input
                      type="text"
                      placeholder="e.g. New contribution plan available"
                      aria-invalid={!!form.formState.errors.title}
                      {...field}
                    />
                    <FieldError errors={form.formState.errors.title ? [form.formState.errors.title] : []} />
                  </>
                )}
              />
            </Field>

            <Field>
              <FieldLabel>Message</FieldLabel>
              <Controller
                control={form.control}
                name="message"
                render={({ field }) => (
                  <>
                    <Textarea
                      rows={4}
                      placeholder="Write your message…"
                      aria-invalid={!!form.formState.errors.message}
                      {...field}
                    />
                    <FieldError errors={form.formState.errors.message ? [form.formState.errors.message] : []} />
                  </>
                )}
              />
            </Field>
          </FieldGroup>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isPendingSend ||
                (recipient === "user" && !selectedUserId)
              }
            >
              <Send />
              {isPendingSend ? "Sending…" : "Send message"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
