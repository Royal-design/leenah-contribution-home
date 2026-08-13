"use client"

import * as React from "react"
import { Check, X } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/ui/data-table"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useAdminWithdrawals, useReviewWithdrawal } from "@/hooks/queries/use-admin"
import { formatDate, formatNaira } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Withdrawal } from "@/types"

const PAGE_SIZE = 10

const statusMeta: Record<Withdrawal["status"], { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "border-transparent bg-warning/15 text-warning dark:bg-warning/20",
  },
  approved: {
    label: "Approved",
    className: "border-transparent bg-info/15 text-info dark:bg-info/25",
  },
  rejected: {
    label: "Rejected",
    className: "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/20",
  },
  completed: {
    label: "Completed",
    className: "border-transparent bg-success/15 text-success dark:bg-success/20",
  },
}

export function WithdrawalsTable({
  items,
  onReview,
}: {
  items: Withdrawal[]
  onReview: (withdrawal: {
    id: string
    name: string
    amount: number
    action: "approved" | "rejected"
  }) => void
}) {
  const columns: ColumnDef<Withdrawal>[] = [
    {
      accessorKey: "accountName",
      header: "Account",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.accountName || row.original.destination}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatNaira(row.original.amount)}</span>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <span className="text-muted-foreground capitalize">{row.original.type}</span>
      ),
    },
    {
      accessorKey: "requestedAt",
      header: "Requested",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.requestedAt)}
        </span>
      ),
    },
    {
      accessorKey: "destination",
      header: "Destination",
      cell: ({ row }) => (
        <span className="max-w-[14rem] truncate text-muted-foreground">
          {row.original.destination}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = statusMeta[row.original.status]
        return (
          <Badge variant="outline" className={cn("font-medium", status.className)}>
            {status.label}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      header: "Actions",
      meta: { align: "right" },
      cell: ({ row }) => {
        if (row.original.status !== "pending") {
          return (
            <span className="text-xs text-muted-foreground">
              {row.original.status}
            </span>
          )
        }
        const name = row.original.accountName || row.original.destination
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Approve ${name}'s withdrawal`}
              onClick={() =>
                onReview({
                  id: row.original.id,
                  name,
                  amount: row.original.amount,
                  action: "approved",
                })
              }
            >
              <Check className="text-success" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Reject ${name}'s withdrawal`}
              onClick={() =>
                onReview({
                  id: row.original.id,
                  name,
                  amount: row.original.amount,
                  action: "rejected",
                })
              }
            >
              <X className="text-destructive" />
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={items}
      emptyText="No withdrawals found."
      mobileCard={({ original }) => {
        const status = statusMeta[original.status]
        const name = original.accountName || original.destination
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground capitalize">
                  {original.type} · {formatDate(original.requestedAt)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums">
                  {formatNaira(original.amount)}
                </p>
                <Badge variant="outline" className={cn("mt-1 font-medium", status.className)}>
                  {status.label}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm text-muted-foreground">
                {original.destination}
              </p>
              {original.status === "pending" ? (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Approve ${name}'s withdrawal`}
                    onClick={() =>
                      onReview({
                        id: original.id,
                        name,
                        amount: original.amount,
                        action: "approved",
                      })
                    }
                  >
                    <Check className="text-success" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Reject ${name}'s withdrawal`}
                    onClick={() =>
                      onReview({
                        id: original.id,
                        name,
                        amount: original.amount,
                        action: "rejected",
                      })
                    }
                  >
                    <X className="text-destructive" />
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {original.status}
                </span>
              )}
            </div>
          </div>
        )
      }}
    />
  )
}

export default function AdminWithdrawalsPage() {
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState<"all" | "pending" | "approved" | "rejected" | "completed">(
    "pending"
  )

  const { data, isPending } = useAdminWithdrawals({
    page,
    pageSize: PAGE_SIZE,
    status: status === "all" ? undefined : status,
  })
  const reviewWithdrawal = useReviewWithdrawal()
  const [pendingReview, setPendingReview] = React.useState<{
    id: string
    name: string
    amount: number
    action: "approved" | "rejected"
  } | null>(null)

  const items = data?.items ?? []

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Withdrawals"
        description="Review and manage withdrawal requests."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={(value) => {
            setStatus(value as typeof status)
            setPage(1)
          }}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No withdrawals found.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl bg-card shadow-sm">
            <div className="overflow-x-auto">
              <WithdrawalsTable items={items} onReview={setPendingReview} />
            </div>
          </div>
          <Pagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={!!pendingReview}
        onOpenChange={(open) => !open && setPendingReview(null)}
        title={pendingReview?.action === "approved" ? "Approve withdrawal" : "Reject withdrawal"}
        description={
          pendingReview
            ? `Confirm ${pendingReview.action === "approved" ? "approval" : "rejection"} of ${formatNaira(
                pendingReview.amount
              )} for ${pendingReview.name}.`
            : ""
        }
        confirmLabel={pendingReview?.action === "approved" ? "Approve" : "Reject"}
        destructive={pendingReview?.action === "rejected"}
        loading={reviewWithdrawal.isPending}
        onConfirm={() => {
          if (!pendingReview) return
          reviewWithdrawal.mutate({
            withdrawalId: pendingReview.id,
            status: pendingReview.action,
          })
          setPendingReview(null)
        }}
      />
    </div>
  )
}