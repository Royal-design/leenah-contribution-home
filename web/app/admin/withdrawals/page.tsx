"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Check, X, CheckCheck, Plus } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/ui/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CommissionBreakdown } from "@/components/shared/commission-breakdown"
import { WithdrawForUserDialog } from "@/components/admin/withdraw-for-user-dialog"
import { useAdminCompleteWithdrawal, useAdminWithdrawals, useReviewWithdrawal } from "@/hooks/queries/use-admin"
import { formatDate, formatNaira } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Withdrawal, WithdrawalStatus } from "@/types"

const PAGE_SIZE = 10

const statusMeta: Record<WithdrawalStatus, { label: string; className: string }> = {
  pending: { label: "Pending approval", className: "border-transparent bg-warning/15 text-warning dark:bg-warning/20" },
  approved: { label: "Approved", className: "border-transparent bg-info/15 text-info dark:bg-info/25" },
  processing: { label: "Processing", className: "border-transparent bg-info/15 text-info dark:bg-info/25" },
  rejected: { label: "Rejected", className: "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/20" },
  completed: { label: "Completed", className: "border-transparent bg-success/15 text-success dark:bg-success/20" },
  failed: { label: "Failed", className: "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/20" },
  reversed: { label: "Reversed", className: "border-transparent bg-warning/15 text-warning dark:bg-warning/20" },
}

const sourceLabels: Record<string, string> = {
  all: "All sources",
  wallet: "Wallet",
  savings_plan: "Savings plan",
  contribution: "Contribution",
  emergency: "Emergency",
  admin: "Admin payout",
}

export function WithdrawalsTable({
  items,
  onReview,
  onComplete,
}: {
  items: Withdrawal[]
  onReview: (withdrawal: Withdrawal, action: "approved" | "rejected") => void
  onComplete: (withdrawal: Withdrawal) => void
}) {
  const columns: ColumnDef<Withdrawal>[] = [
    {
      accessorKey: "userName",
      header: "User",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.userName || "—"}</span>
          {row.original.source === "emergency" && (
            <span className="text-xs text-warning">Emergency</span>
          )}
        </div>
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
      accessorKey: "destination",
      header: "Destination",
      cell: ({ row }) => (
        <span className="max-w-[11rem] truncate text-muted-foreground">
          {row.original.destination}
        </span>
      ),
    },
    {
      accessorKey: "grossAmount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatNaira(row.original.grossAmount ?? row.original.amount)}</span>
      ),
    },
    {
      accessorKey: "commissionAmount",
      header: "Commission",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {(row.original.commissionAmount ?? 0) > 0
            ? formatNaira(row.original.commissionAmount ?? 0)
            : "—"}
        </span>
      ),
    },
    {
      accessorKey: "netAmount",
      header: "Net",
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {formatNaira(row.original.netAmount ?? row.original.amount)}
        </span>
      ),
    },
    {
      accessorKey: "requestedAt",
      header: "Requested",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.requestedAt)}</span>
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
        if (row.original.status === "approved") {
          return (
            <div className="flex items-center justify-end">
              <Button variant="ghost" size="sm" onClick={() => onComplete(row.original)}>
                <CheckCheck className="text-success" />
                Mark completed
              </Button>
            </div>
          )
        }
        if (row.original.status !== "pending") {
          return <span className="text-xs text-muted-foreground">{row.original.status}</span>
        }
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Approve withdrawal"
              onClick={() => onReview(row.original, "approved")}
            >
              <Check className="text-success" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Reject withdrawal"
              onClick={() => onReview(row.original, "rejected")}
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
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{original.userName || "—"}</p>
                <p className="mt-0.5 text-sm text-muted-foreground capitalize">
                  {original.type} · {formatDate(original.requestedAt)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums">
                  {formatNaira(original.netAmount ?? original.amount)}
                </p>
                <Badge variant="outline" className={cn("mt-1 font-medium", status.className)}>
                  {status.label}
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="truncate text-muted-foreground">{original.destination}</p>
              {(original.commissionAmount ?? 0) > 0 && (
                <p className="shrink-0 text-xs text-muted-foreground">
                  Commission {formatNaira(original.commissionAmount ?? 0)}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-1">
              {original.status === "pending" ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReview(original, "approved")}
                  >
                    <Check className="text-success" /> Approve
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReview(original, "rejected")}
                  >
                    <X className="text-destructive" /> Reject
                  </Button>
                </>
              ) : original.status === "approved" ? (
                <Button variant="ghost" size="sm" onClick={() => onComplete(original)}>
                  <CheckCheck className="text-success" /> Mark completed
                </Button>
              ) : null}
            </div>
          </div>
        )
      }}
    />
  )
}

function ReviewDialog({
  withdrawal,
  action,
  onClose,
}: {
  withdrawal: Withdrawal | null
  action: "approved" | "rejected"
  onClose: () => void
}) {
  const review = useReviewWithdrawal()
  const [reason, setReason] = React.useState("")

  const gross = withdrawal?.grossAmount ?? withdrawal?.amount ?? 0
  const net = withdrawal?.netAmount ?? withdrawal?.amount ?? 0

  return (
    <Dialog open={!!withdrawal && !!action} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action === "approved" ? "Approve withdrawal?" : "Reject withdrawal?"}
          </DialogTitle>
          <DialogDescription>
            {action === "approved"
              ? "Review the financial summary before approving this payout."
              : "Rejecting will not move any money. Provide the reason for this decision."}
          </DialogDescription>
        </DialogHeader>

        {withdrawal && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">User</span>
                <span className="font-medium">
                  {withdrawal.userName || withdrawal.userId}
                  {withdrawal.source === "emergency" && (
                    <Badge variant="outline" className="ml-2 bg-warning/15 text-warning">
                      Emergency
                    </Badge>
                  )}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-muted-foreground">Destination</span>
                <span className="max-w-[55%] truncate text-right font-medium">
                  {withdrawal.destination}
                </span>
              </div>
              {withdrawal.reason && (
                <div className="mt-1.5 flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Reason</span>
                  <span className="max-w-[60%] text-right">{withdrawal.reason}</span>
                </div>
              )}
            </div>

            <CommissionBreakdown
              gross={gross}
              commission={withdrawal.commissionAmount}
              fee={withdrawal.feeAmount}
              net={net}
              netLabel={action === "approved" ? "Amount paid out" : "Net amount"}
            />

            {action === "approved" && (
              <p className="text-xs text-muted-foreground">
                {withdrawal.channel === "wallet"
                  ? "The net amount will be credited to the user's wallet."
                  : "A paystack transfer for the net amount will be initiated to the destination bank account."}
              </p>
            )}

            {action === "rejected" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Reason for rejection</label>
                <Input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. Insufficient documentation provided."
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={review.isPending}>
            Cancel
          </Button>
          <Button
            variant={action === "rejected" ? "destructive" : "default"}
            disabled={
              review.isPending ||
              (action === "rejected" && reason.trim().length === 0)
            }
            onClick={() => {
              if (!withdrawal) return
              review.mutate(
                {
                  withdrawalId: withdrawal.id,
                  status: action,
                  reason: action === "rejected" ? reason.trim() : undefined,
                },
                { onSuccess: onClose }
              )
            }}
          >
            {review.isPending
              ? "Working…"
              : action === "approved"
                ? "Approve withdrawal"
                : "Reject withdrawal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminWithdrawalsPage() {
  const params = useSearchParams()
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState<"all" | "pending" | "approved" | "rejected" | "completed" | "processing" | "failed">(
    () => {
      const s = params.get("status")
      return s && s !== "pending" && s !== "all"
        ? (s as "approved" | "rejected" | "completed" | "processing" | "failed")
        : (s === "all" ? "all" : "pending")
    }
  )
  const [source, setSource] = React.useState<string>(() => params.get("source") ?? "all")

  const { data, isPending } = useAdminWithdrawals({
    page,
    pageSize: PAGE_SIZE,
    status: status === "all" ? undefined : status,
    source: source === "all" ? undefined : (source as "wallet" | "savings_plan" | "contribution" | "emergency" | "admin"),
  })
  const completeWithdrawal = useAdminCompleteWithdrawal()
  const [pendingReview, setPendingReview] = React.useState<{
    withdrawal: Withdrawal
    action: "approved" | "rejected"
  } | null>(null)
  const [pendingComplete, setPendingComplete] = React.useState<Withdrawal | null>(null)
  const [payoutOpen, setPayoutOpen] = React.useState(false)

  const items = data?.items ?? []

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={source === "emergency" ? "Emergency requests" : "Withdrawals"}
        description={
          source === "emergency"
            ? "Users requesting early access to their funds."
            : "Review and manage withdrawal and payout requests."
        }
      >
        <Button onClick={() => setPayoutOpen(true)}>
          <Plus />
          Withdraw / pay user
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={source}
          onValueChange={(value) => {
            setSource(value ?? "all")
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by source">
            <SelectValue>
              {(value) => sourceLabels[(value as string) ?? "all"] ?? "All sources"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="wallet">Wallet</SelectItem>
            <SelectItem value="savings_plan">Savings plan</SelectItem>
            <SelectItem value="contribution">Contribution</SelectItem>
            <SelectItem value="emergency">Emergency</SelectItem>
            <SelectItem value="admin">Admin payout</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value as typeof status)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-48" aria-label="Filter by status">
            <SelectValue>
              {(value) => {
                const v = value as string
                const label =
                  v === "all"
                    ? "All statuses"
                    : v
                      ? statusMeta[v as WithdrawalStatus].label
                      : "Status"
                return label
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending approval</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
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
          {source === "emergency"
            ? "No emergency requests found."
            : "No withdrawals found."}
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl bg-card shadow-sm">
            <div className="overflow-x-auto">
              <WithdrawalsTable
                items={items}
                onReview={(withdrawal, action) => setPendingReview({ withdrawal, action })}
                onComplete={setPendingComplete}
              />
            </div>
          </div>
          <Pagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}

      <ReviewDialog
        key={
          pendingReview
            ? `${pendingReview.withdrawal.id}-${pendingReview.action}`
            : "closed"
        }
        withdrawal={pendingReview?.withdrawal ?? null}
        action={pendingReview?.action ?? "approved"}
        onClose={() => setPendingReview(null)}
      />

      <Dialog
        open={!!pendingComplete}
        onOpenChange={(open) => !open && setPendingComplete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark withdrawal as completed?</DialogTitle>
            <DialogDescription>
              Confirm that this payout has been delivered before marking it complete.
            </DialogDescription>
          </DialogHeader>
          {pendingComplete && (
            <CommissionBreakdown
              gross={pendingComplete.grossAmount ?? pendingComplete.amount}
              commission={pendingComplete.commissionAmount}
              fee={pendingComplete.feeAmount}
              net={pendingComplete.netAmount ?? pendingComplete.amount}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingComplete(null)} disabled={completeWithdrawal.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!pendingComplete) return
                completeWithdrawal.mutate(pendingComplete.id, {
                  onSuccess: () => setPendingComplete(null),
                })
              }}
              disabled={completeWithdrawal.isPending}
            >
              {completeWithdrawal.isPending ? "Working…" : "Mark completed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WithdrawForUserDialog open={payoutOpen} onOpenChange={setPayoutOpen} />
    </div>
  )
}