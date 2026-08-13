"use client"

import * as React from "react"
import { Users, PiggyBank, ArrowLeftRight, Bell } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/pagination"
import { EmptyState } from "@/components/shared/empty-state"
import {
  useNotifications,
  useMarkNotificationsRead,
  useMarkAllNotificationsRead,
} from "@/hooks/queries/use-transactions"
import { formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { NotificationType } from "@/types"

const typeIcons: Record<NotificationType, typeof Bell> = {
  contribution: Users,
  savings: PiggyBank,
  withdrawal: ArrowLeftRight,
  system: Bell,
}

const PAGE_SIZE = 20

export default function NotificationsPage() {
  const [page, setPage] = React.useState(1)
  const { data, isPending } = useNotifications({ page, pageSize: PAGE_SIZE })
  const markRead = useMarkNotificationsRead()
  const markAllRead = useMarkAllNotificationsRead()

  const items = data?.items ?? []

  function handleMarkAllRead() {
    markAllRead.mutate()
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
          disabled={markAllRead.isPending}
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

      {!isPending && items.length === 0 && (
        <EmptyState title="You're all caught up" description="No notifications right now." />
      )}

      {!isPending && items.length > 0 && (
        <Card className="divide-y divide-border">
          {items.map((notification) => {
            const Icon = typeIcons[notification.type] ?? Bell
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => {
                  if (!notification.read) {
                    markRead.mutate([notification.id])
                  }
                }}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40",
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
              </button>
            )
          })}
        </Card>
      )}

      <Pagination
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
      />
    </div>
  )
}