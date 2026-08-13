"use client"

import * as React from "react"

import { PageHeader } from "@/components/shared/page-header"
import { TransactionTable } from "@/components/transactions/transaction-table"
import { TransactionsList } from "@/components/transactions/transaction-list"
import { Skeleton } from "@/components/ui/skeleton"
import { Pagination } from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useAdminTransactions } from "@/hooks/queries/use-admin"
import { useRevertTransaction } from "@/hooks/queries/use-admin"
import { formatNaira } from "@/lib/format"
import type { Transaction, TransactionStatus, TransactionType } from "@/types"

const PAGE_SIZE = 10

export default function AdminTransactionsPage() {
  const [page, setPage] = React.useState(1)
  const [type, setType] = React.useState<TransactionType | "all">("all")
  const [status, setStatus] = React.useState<TransactionStatus | "all">("all")

  const { data, isPending } = useAdminTransactions({
    page,
    pageSize: PAGE_SIZE,
    type: type === "all" ? undefined : type,
    status: status === "all" ? undefined : status,
  })
  const revertTransaction = useRevertTransaction()
  const [pendingRevert, setPendingRevert] = React.useState<Transaction | null>(null)

  const items = data?.items ?? []

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Transactions"
        description="All financial movements across the platform."
      />

      <div className="grid gap-3 sm:grid-cols-[auto_auto]">
        <Select value={type} onValueChange={(value) => {
            setType(value as TransactionType | "all")
            setPage(1)
          }}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="contribution">Contribution</SelectItem>
            <SelectItem value="savings">Savings</SelectItem>
            <SelectItem value="funding">Funding</SelectItem>
            <SelectItem value="withdrawal">Withdrawal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => {
            setStatus(value as TransactionStatus | "all")
            setPage(1)
          }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="successful">Successful</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="reverted">Reverted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : items.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-xl bg-card shadow-sm md:block">
            <div className="overflow-x-auto">
              <TransactionTable transactions={items} onRevert={setPendingRevert} />
            </div>
          </div>
          <div className="rounded-xl bg-card shadow-sm md:hidden">
            <TransactionsList transactions={items} />
          </div>
          <Pagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No transactions found.
        </p>
      )}

      <ConfirmDialog
        open={!!pendingRevert}
        onOpenChange={(open) => !open && setPendingRevert(null)}
        title="Revert transaction?"
        description={
          pendingRevert
            ? `Mark the failed ${formatNaira(pendingRevert.amount)} transaction as reverted? This reverses its effect on balances.`
            : ""
        }
        confirmLabel="Revert"
        loading={revertTransaction.isPending}
        onConfirm={() => {
          if (!pendingRevert) return
          revertTransaction.mutate(pendingRevert.id)
          setPendingRevert(null)
        }}
      />
    </div>
  )
}