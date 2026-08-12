"use client"

import * as React from "react"
import { Users, PiggyBank, ArrowLeftRight, Bell } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { useNotifications, useMarkNotificationsRead } from "@/hooks/queries/use-transactions"
import { formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { NotificationType } from "@/types"

const typeIcons: Record<NotificationType, typeof Bell> = {
  contribution: Users,
  savings: PiggyBank,
  withdrawal: ArrowLeftRight,
  system: Bell,
}

export default function NotificationsPage() {
  const { data, isPending } = useNotifications()
  const markRead = useMarkNotificationsRead()

  const unreadIds = (data ?? []).filter((n) => !n.read).map((n) => n.id)

  function handleMarkAllRead() {
    if (unreadIds.length > 0) {
      markRead.mutate(unreadIds)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Notifications"
        description="Stay on top of your contributions and savings."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkAllRead}
          disabled={unreadIds.length === 0 || markRead.isPending}
        >
          Mark all as read
        </Button>
      </PageHeader>

      {isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      )}

      {data && data.length === 0 && (
        <EmptyState title="You're all caught up" description="No notifications right now." />
      )}

      {data && data.length > 0 && (
        <Card className="divide-y divide-border">
          {data.map((notification) => {
            const Icon = typeIcons[notification.type] ?? Bell
            return (
              <div
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-4",
                  !notification.read && "bg-primary/5"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    notification.type === "contribution"
                      ? "bg-primary/10 text-primary"
                      : notification.type === "savings"
                        ? "bg-success/15 text-success"
                        : notification.type === "withdrawal"
                          ? "bg-warning/15 text-warning"
                          : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{notification.title}</p>
                    {!notification.read && (
                      <span
                        className="size-2 shrink-0 rounded-full bg-primary"
                        aria-label="Unread"
                      />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}