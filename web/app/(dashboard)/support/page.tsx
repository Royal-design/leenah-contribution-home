"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Search, MessageSquare } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { NewThreadDialog } from "@/components/support/new-thread-dialog"
import { useSupportThreads } from "@/hooks/queries/use-support"
import { formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { SupportStatus } from "@/types"

const PAGE_SIZE = 10

const statusTone: Record<SupportStatus, string> = {
  open: "border-transparent bg-warning/15 text-warning dark:bg-warning/20",
  replied: "border-transparent bg-info/15 text-info dark:bg-info/25",
  resolved: "border-transparent bg-success/15 text-success dark:bg-success/20",
}

export default function SupportPage() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<SupportStatus | "all">("all")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [newOpen, setNewOpen] = React.useState(false)

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
        title="Help & Support"
        description="Reach out to the LCH team and track your conversations."
      >
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus />
          New message
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
            placeholder="Search your conversations…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-8"
            aria-label="Search support conversations"
          />
        </div>
        <Select value={status} onValueChange={(value) => {
            setStatus(value as SupportStatus | "all")
            setPage(1)
          }}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
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
        <EmptyState
          title="No conversations"
          description="Start a new conversation and we'll get back to you."
          action={{ label: "New message", onAction: () => setNewOpen(true) }}
        />
      )}

      {!isPending && items.length > 0 && (
        <>
          <div className="flex flex-col overflow-hidden rounded-xl bg-card shadow-sm">
            {items.map((thread) => (
              <Link
                key={thread.id}
                href={`/support/${thread.id}`}
                className="flex items-start gap-4 border-b border-border px-4 py-4 transition-colors last:border-0 hover:bg-muted/40"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MessageSquare className="size-5" aria-hidden="true" />
                </span>
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
                    <Badge variant="outline" className="font-normal capitalize">
                      {thread.category}
                    </Badge>
                    <span>·</span>
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

      <NewThreadDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}