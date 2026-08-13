"use client"

import * as React from "react"
import { Search, Trash2 } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/ui/data-table"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useAuditLogs, auditActionLabel, useDeleteAuditLog } from "@/hooks/queries/use-audit-logs"
import { formatDate, formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { AuditAction, AuditCategory, AuditLog } from "@/types"

const PAGE_SIZE = 10

const actionTone: Record<string, string> = {
  create: "border-transparent bg-success/15 text-success dark:bg-success/20",
  update: "border-transparent bg-info/15 text-info dark:bg-info/25",
  delete: "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/20",
  approve: "border-transparent bg-success/15 text-success dark:bg-success/20",
  reject: "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/20",
  revert: "border-transparent bg-warning/15 text-warning dark:bg-warning/20",
  suspend: "border-transparent bg-warning/15 text-warning dark:bg-warning/20",
  reactivate: "border-transparent bg-success/15 text-success dark:bg-success/20",
  invite: "border-transparent bg-info/15 text-info dark:bg-info/25",
  login: "border-transparent bg-muted text-muted-foreground dark:bg-muted/40",
  logout: "border-transparent bg-muted text-muted-foreground dark:bg-muted/40",
  settings_update: "border-transparent bg-info/15 text-info dark:bg-info/25",
}

const actions: AuditAction[] = [
  "create",
  "update",
  "delete",
  "approve",
  "reject",
  "revert",
  "suspend",
  "reactivate",
  "invite",
  "login",
  "logout",
  "settings_update",
]

const categories: AuditCategory[] = [
  "user",
  "contribution",
  "savings",
  "withdrawal",
  "transaction",
  "system",
  "settings",
]

export default function AuditLogsPage() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [action, setAction] = React.useState<AuditAction | "all">("all")
  const [category, setCategory] = React.useState<AuditCategory | "all">("all")
  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isPending, refetch, isError } = useAuditLogs({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    action: action === "all" ? undefined : action,
    category: category === "all" ? undefined : category,
    from: from || undefined,
    to: to || undefined,
  })
  const deleteAuditLog = useDeleteAuditLog()
  const [pendingDelete, setPendingDelete] = React.useState<AuditLog | null>(null)

  const items = data?.items ?? []

  const columns: ColumnDef<AuditLog>[] = [
    {
      accessorKey: "actorName",
      header: "Actor",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.original.actorName ?? "System"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.actorEmail ?? row.original.actorRole ?? ""}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn(
            "font-medium capitalize",
            actionTone[row.original.action] ?? "border-transparent bg-muted text-muted-foreground"
          )}
        >
          {auditActionLabel(row.original.action)}
        </Badge>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-muted-foreground capitalize">
          {row.original.category}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="line-clamp-1 max-w-[18rem] text-muted-foreground">
          {row.original.description}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "When",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatRelativeTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      meta: { align: "right" },
      cell: ({ row }) => (
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete audit log entry"
            onClick={() => setPendingDelete(row.original)}
          >
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Audit logs"
        description="A trail of every important action on the platform."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search by actor or description…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-8"
            aria-label="Search audit logs"
          />
        </div>
        <Select value={action} onValueChange={(value) => {
            setAction(value as AuditAction | "all")
            setPage(1)
          }}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by action">
            <SelectValue>
              {(value) =>
                (value as string) === "all"
                  ? "All actions"
                  : auditActionLabel((value as AuditAction) ?? "create")
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((item) => (
              <SelectItem key={item} value={item}>
                {auditActionLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(value) => {
            setCategory(value as AuditCategory | "all")
            setPage(1)
          }}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((item) => (
              <SelectItem key={item} value={item}>
                <span className="capitalize">{item}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          aria-label="From date"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value)
            setPage(1)
          }}
          className="w-full sm:w-40"
        />
        <Input
          type="date"
          aria-label="To date"
          value={to}
          onChange={(event) => {
            setTo(event.target.value)
            setPage(1)
          }}
          className="w-full sm:w-40"
        />
      </div>

      {isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
          <p className="text-sm text-destructive">Could not load audit logs.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {items.length === 0 && !isPending && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No audit log entries matched your filters.
        </p>
      )}

      {items.length > 0 && (
        <>
          <div className="overflow-hidden rounded-xl bg-card shadow-sm">
            <DataTable
              columns={columns}
              data={items}
              mobileCard={({ original }) => (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate font-medium">
                      {original.actorName ?? "System"}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-medium capitalize",
                          actionTone[original.action] ?? "border-transparent bg-muted text-muted-foreground"
                        )}
                      >
                        {auditActionLabel(original.action)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete audit log entry"
                        onClick={() => setPendingDelete(original)}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {original.description}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {original.category} · {formatDate(original.createdAt)}
                  </p>
                </div>
              )}
            />
          </div>
          <Pagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete audit log entry?"
        description={
          pendingDelete
            ? `Delete this ${auditActionLabel(pendingDelete.action)} audit log entry? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        loading={deleteAuditLog.isPending}
        onConfirm={() => {
          if (!pendingDelete) return
          deleteAuditLog.mutate(pendingDelete.id, {
            onSuccess: () => setPendingDelete(null),
          })
        }}
      />
    </div>
  )
}