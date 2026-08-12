"use client"

import * as React from "react"

import { PageHeader } from "@/components/shared/page-header"
import { TransactionTable } from "@/components/transactions/transaction-table"
import { TransactionsList } from "@/components/transactions/transaction-list"
import { Skeleton } from "@/components/ui/skeleton"
import { useTransactions } from "@/hooks/queries/use-transactions"

export default function AdminTransactionsPage() {
  const { data, isPending } = useTransactions()

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
          <div className="hidden rounded-xl border bg-card md:block">
            <TransactionTable transactions={data} />
          </div>
          <div className="rounded-xl border bg-card md:hidden">
            <TransactionsList transactions={data} />
          </div>
        </>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No transactions yet.
        </p>
      )}
    </div>
  )
}