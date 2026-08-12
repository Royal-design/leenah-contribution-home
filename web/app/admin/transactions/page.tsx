"use client"

import * as React from "react"

import { PageHeader } from "@/components/shared/page-header"
import { TransactionTable } from "@/components/transactions/transaction-table"
import { TransactionsList } from "@/components/transactions/transaction-list"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useTransactions } from "@/hooks/queries/use-transactions"
import { useRevertTransaction } from "@/hooks/queries/use-admin"
import { formatNaira } from "@/lib/format"
import type { Transaction } from "@/types"

export default function AdminTransactionsPage() {
  const { data, isPending } = useTransactions()
  const revertTransaction = useRevertTransaction()
  const [pendingRevert, setPendingRevert] = React.useState<Transaction | null>(null)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Transactions"
        description="All financial movements across the platform."
      />

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : data && data.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-xl bg-card shadow-sm md:block">
            <div className="overflow-x-auto">
              <TransactionTable transactions={data} onRevert={setPendingRevert} />
            </div>
          </div>
          <div className="rounded-xl bg-card shadow-sm md:hidden">
            <TransactionsList transactions={data} />
          </div>
        </>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No transactions yet.
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