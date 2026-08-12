"use client"

import * as React from "react"
import { Search, ArrowLeftRight } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { TransactionTable } from "@/components/transactions/transaction-table"
import { TransactionsList } from "@/components/transactions/transaction-list"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { useTransactions } from "@/hooks/queries/use-transactions"
import type { TransactionStatus, TransactionType } from "@/types"

export default function TransactionsPage() {
  const [search, setSearch] = React.useState("")
  const [type, setType] = React.useState<TransactionType | "all">("all")
  const [status, setStatus] = React.useState<TransactionStatus | "all">("all")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data, isPending, isError, refetch } = useTransactions({
    search: debouncedSearch || undefined,
    type,
    status,
  })

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Transactions"
        description="Every movement in your account, in one place."
      >
        <Button variant="outline" size="sm" disabled>
          <ArrowLeftRight />
          Export
        </Button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search by description or reference…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-8"
            aria-label="Search transactions"
          />
        </div>
        <Select value={type} onValueChange={(value) => setType(value as TransactionType | "all")}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by type">
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
        <Select value={status} onValueChange={(value) => setStatus(value as TransactionStatus | "all")}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="successful">Successful</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
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
          <p className="text-sm text-destructive">Could not load transactions.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && data.length === 0 && (
        <EmptyState
          title="No transactions found"
          description="Try adjusting your search or filters."
        />
      )}

      {data && data.length > 0 && (
        <>
          <div className="hidden rounded-xl border bg-card md:block">
            <TransactionTable transactions={data} />
          </div>
          <div className="rounded-xl border bg-card md:hidden">
            <TransactionsList transactions={data} />
          </div>
        </>
      )}
    </div>
  )
}