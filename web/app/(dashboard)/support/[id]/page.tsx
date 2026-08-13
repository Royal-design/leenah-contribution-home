"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft, Send, Headset } from "lucide-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import * as z from "zod"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  useSupportThread,
  useReplySupportThread,
  useUpdateSupportThreadStatus,
} from "@/hooks/queries/use-support"
import { useAuthStore } from "@/stores/auth-store"
import { formatDate, formatRelativeTime, getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { SupportStatus } from "@/types"

const replySchema = z.object({
  body: z.string().trim().min(1, "Write a reply.").max(4000),
})

type ReplyValues = z.infer<typeof replySchema>

const statusTone: Record<SupportStatus, string> = {
  open: "border-transparent bg-warning/15 text-warning dark:bg-warning/20",
  replied: "border-transparent bg-info/15 text-info dark:bg-info/25",
  resolved: "border-transparent bg-success/15 text-success dark:bg-success/20",
}

export default function SupportThreadDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { data: thread, isPending, isError } = useSupportThread(id)
  const replyThread = useReplySupportThread()
  const updateStatus = useUpdateSupportThreadStatus()
  const currentUserId = useAuthStore((state) => state.user?.id)

  const form = useForm<ReplyValues>({
    resolver: zodResolver(replySchema),
    defaultValues: { body: "" },
  })

  function onSubmit(values: ReplyValues) {
    replyThread.mutate(
      { id, body: values.body },
      {
        onSuccess: () => form.reset(),
      }
    )
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-72" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-3/4 rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !thread) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
        <p className="text-sm font-medium">Conversation not found.</p>
        <Button variant="outline" size="sm" render={<Link href="/support" />}>
          Back to support
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/support" />}>
        <ChevronLeft />
        All conversations
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {thread.subject}
            </h1>
            <Badge
              variant="outline"
              className={cn("font-medium capitalize", statusTone[thread.status])}
            >
              {thread.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground capitalize">
            {thread.category} · Opened {formatDate(thread.createdAt)}
          </p>
        </div>
        <Select
          value={thread.status}
          onValueChange={(value) =>
            updateStatus.mutate({ id, status: value as SupportStatus })
          }
        >
          <SelectTrigger size="sm" className="w-40" aria-label="Update thread status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          {thread.messages.map((message) => {
            const mine = message.senderRole === "user" && message.senderId === currentUserId
            return (
              <div
                key={message.id}
                className={cn("flex gap-3", mine ? "flex-row-reverse" : "")}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    mine ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {message.senderRole === "admin" ? <Headset className="size-4" /> : getInitials(message.senderName)}
                </span>
                <div className={cn("max-w-[80%]", mine ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm",
                      mine
                        ? "rounded-tr-sm bg-primary/10 text-foreground"
                        : "rounded-tl-sm bg-muted text-foreground"
                    )}
                  >
                    <p className="font-medium text-xs mb-1">
                      {message.senderName}
                      {message.senderRole === "admin" && (
                        <span className="ml-2 text-primary">LCH Team</span>
                      )}
                    </p>
                    <p className="whitespace-pre-wrap">{message.body}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeTime(message.createdAt)}
                  </p>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reply</CardTitle>
          <CardDescription>Add a message to this conversation.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Controller
              control={form.control}
              name="body"
              render={({ field }) => (
                <Textarea
                  rows={4}
                  placeholder="Type your reply…"
                  aria-label="Reply message"
                  {...field}
                />
              )}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={replyThread.isPending || form.formState.isSubmitting}
              >
                <Send />
                {replyThread.isPending ? "Sending…" : "Send reply"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}