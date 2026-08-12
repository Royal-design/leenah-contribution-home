"use client"

import * as React from "react"
import { Check, X } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable } from "@/components/ui/data-table"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useAdminWithdrawals, useReviewWithdrawal } from "@/hooks/queries/use-admin"
import { formatDate, formatNaira } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Withdrawal } from "@/types"

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
      accessorKey: "userName",
      header: "User",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.userName}</span>
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
        <span className="text-muted-foreground">{row.original.destination}</span>
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
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Approve ${row.original.userName}'s withdrawal`}
              onClick={() =>
                onReview({
                  id: row.original.id,
                  name: row.original.userName,
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
              aria-label={`Reject ${row.original.userName}'s withdrawal`}
              onClick={() =>
                onReview({
                  id: row.original.id,
                  name: row.original.userName,
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

  return <DataTable columns={columns} data={items} emptyText="No withdrawals found." />
}

export default function AdminWithdrawalsPage() {
  const { data, isPending } = useAdminWithdrawals()
  const reviewWithdrawal = useReviewWithdrawal()
  const [pendingReview, setPendingReview] = React.useState<{
    id: string
    name: string
    amount: number
    action: "approved" | "rejected"
  } | null>(null)

  const pendingItems = (data ?? []).filter((w) => w.status === "pending")
  const resolvedItems = (data ?? []).filter((w) => w.status !== "pending")

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Withdrawals"
        description="Review and manage withdrawal requests."
      />

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <section aria-label="Pending withdrawals">
            <h2 className="font-heading text-lg font-medium tracking-tight">
              Pending{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {pendingItems.length}
              </span>
            </h2>
            <div className="mt-4 overflow-hidden rounded-xl bg-card shadow-sm">
              <div className="overflow-x-auto">
                <WithdrawalsTable
                  items={pendingItems}
                  onReview={setPendingReview}
                />
              </div>
            </div>
          </section>

          <section aria-label="Resolved withdrawals">
            <h2 className="font-heading text-lg font-medium tracking-tight">
              Reviewed{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {resolvedItems.length}
              </span>
            </h2>
            <div className="mt-4 overflow-hidden rounded-xl bg-card shadow-sm">
              <div className="overflow-x-auto">
                <WithdrawalsTable
                  items={resolvedItems}
                  onReview={setPendingReview}
                />
              </div>
            </div>
          </section>
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