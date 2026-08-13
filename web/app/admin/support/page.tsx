"use client"

import * as React from "react"
import Link from "next/link"
import { Search, Send } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/pagination"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SendMessageDialog } from "@/components/admin/send-message-dialog"
import { useSupportThreads } from "@/hooks/queries/use-support"
import { formatRelativeTime, getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { SupportCategory, SupportStatus } from "@/types"

const PAGE_SIZE = 10

const statusTone: Record<SupportStatus, string> = {
  open: "border-transparent bg-warning/15 text-warning dark:bg-warning/20",
  replied: "border-transparent bg-info/15 text-info dark:bg-info/25",
  resolved: "border-transparent bg-success/15 text-success dark:bg-success/20",
}

const statusLabels: Record<string, string> = {
  all: "All statuses",
  open: "Open",
  replied: "Replied",
  resolved: "Resolved",
}

const categoryLabels: Record<SupportCategory, string> = {
  general: "General",
  account: "Account",
  contribution: "Contributions",
  savings: "Savings",
  withdrawal: "Withdrawals",
  other: "Other",
}

export default function AdminSupportPage() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<SupportStatus | "all">("all")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [sendOpen, setSendOpen] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isPending } = useSupportThreads({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
  })

  const items = data?.items ?? []

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Messages"
        description="Support inbox — respond to and resolve user conversations."
      >
        <Button size="sm" onClick={() => setSendOpen(true)}>
          <Send />
          Send message
        </Button>
      </PageHeader>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search by user, email or subject…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-8"
            aria-label="Search conversations"
          />
        </div>
        <Select value={status} onValueChange={(value) => {
            setStatus(value as SupportStatus | "all")
            setPage(1)
          }}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
            <SelectValue>
              {(value) => statusLabels[(value as string) ?? "all"] ?? "All statuses"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      )}

      {!isPending && items.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No conversations matched your filters.
        </p>
      )}

      {!isPending && items.length > 0 && (
        <>
          <div className="flex flex-col overflow-hidden rounded-xl bg-card shadow-sm">
            {items.map((thread) => (
              <Link
                key={thread.id}
                href={`/admin/support/${thread.id}`}
                className="flex items-start gap-4 border-b border-border px-4 py-4 transition-colors last:border-0 hover:bg-muted/40"
              >
                <Avatar>
                  <AvatarFallback>
                    {getInitials(
                      thread.userName || thread.userEmail || thread.userId
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{thread.subject}</p>
                    {thread.unreadCount > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">
                      {thread.userName || "Unknown user"}
                    </span>
                    {thread.userEmail && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{thread.userEmail}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <Badge variant="outline" className="font-normal capitalize">
                      {categoryLabels[thread.category] ?? thread.category}
                    </Badge>
                    <span aria-hidden="true">·</span>
                    <span>{formatRelativeTime(thread.lastMessageAt)}</span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn("shrink-0 font-medium capitalize", statusTone[thread.status])}
                >
                  {thread.status}
                </Badge>
              </Link>
            ))}
          </div>
          <Pagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}

      <SendMessageDialog open={sendOpen} onOpenChange={setSendOpen} />
    </div>
  )
}