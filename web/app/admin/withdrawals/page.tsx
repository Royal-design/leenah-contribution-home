"use client"

import * as React from "react"
import { Check, X } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useAdminWithdrawals, useReviewWithdrawal } from "@/hooks/queries/use-admin"
import { formatDate, formatNaira } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { WithdrawalStatus } from "@/types"

const statusMeta: Record<WithdrawalStatus, { label: string; className: string }> = {
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

function WithdrawalsTable({
  items,
  onReview,
}: {
  items: Array<{
    id: string
    userName: string
    amount: number
    type: string
    requestedAt: string
    destination: string
    status: WithdrawalStatus
  }>
  onReview: (withdrawal: {
    id: string
    name: string
    amount: number
    action: "approved" | "rejected"
  }) => void
}) {
  return (
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items ?? []).map((withdrawal) => {
              const status = statusMeta[withdrawal.status]
              return (
                <TableRow key={withdrawal.id}>
                  <TableCell className="font-medium">{withdrawal.userName}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatNaira(withdrawal.amount)}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {withdrawal.type}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(withdrawal.requestedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {withdrawal.destination}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("font-medium", status.className)}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {withdrawal.status === "pending" ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Approve ${withdrawal.userName}'s withdrawal`}
                          onClick={() =>
                            onReview({
                              id: withdrawal.id,
                              name: withdrawal.userName,
                              amount: withdrawal.amount,
                              action: "approved",
                            })
                          }
                        >
                          <Check className="text-success" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Reject ${withdrawal.userName}'s withdrawal`}
                          onClick={() =>
                            onReview({
                              id: withdrawal.id,
                              name: withdrawal.userName,
                              amount: withdrawal.amount,
                              action: "rejected",
                            })
                          }
                        >
                          <X className="text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {withdrawal.status}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
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
            <div className="mt-4">
              <WithdrawalsTable
                items={pendingItems}
                onReview={setPendingReview}
              />
            </div>
          </section>

          <section aria-label="Resolved withdrawals">
            <h2 className="font-heading text-lg font-medium tracking-tight">
              Reviewed{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {resolvedItems.length}
              </span>
            </h2>
            <div className="mt-4">
              <WithdrawalsTable
                items={resolvedItems}
                onReview={setPendingReview}
              />
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