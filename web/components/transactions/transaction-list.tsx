"use client"

import Link from "next/link"
import { PiggyBank, Users, Wallet, ArrowLeftRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { formatDate, formatNaira } from "@/lib/format"
import type { Transaction, TransactionStatus, TransactionType } from "@/types"

export const transactionTypeMeta: Record<
  TransactionType,
  { label: string; icon: typeof Wallet; tone: string }
> = {
  contribution: {
    label: "Contribution",
    icon: Users,
    tone: "bg-primary/10 text-primary",
  },
  savings: { label: "Savings", icon: PiggyBank, tone: "bg-success/15 text-success" },
  funding: { label: "Funding", icon: Wallet, tone: "bg-info/15 text-info" },
  withdrawal: {
    label: "Withdrawal",
    icon: ArrowLeftRight,
    tone: "bg-warning/15 text-warning",
  },
}

export const transactionStatusMeta: Record<
  TransactionStatus,
  { label: string; className: string }
> = {
  successful: {
    label: "Successful",
    className:
      "border-transparent bg-success/15 text-success dark:bg-success/20",
  },
  pending: {
    label: "Pending",
    className: "border-transparent bg-warning/15 text-warning dark:bg-warning/20",
  },
  failed: {
    label: "Failed",
    className:
      "border-transparent bg-destructive/15 text-destructive dark:bg-destructive/20",
  },
}

function TransactionTypeIcon({
  type,
  className,
}: {
  type: TransactionType
  className?: string
}) {
  const meta = transactionTypeMeta[type]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg",
        meta.tone,
        className
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </span>
  )
}

export function TransactionItem({ transaction }: { transaction: Transaction }) {
  const status = transactionStatusMeta[transaction.status]
  const isIncoming = transaction.type !== "withdrawal"

  return (
    <div className="flex items-center gap-3 px-2 py-2.5">
      <TransactionTypeIcon type={transaction.type} />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-sm font-medium">{transaction.description}</p>
        <p className="text-xs text-muted-foreground">
          {formatDate(transaction.date)} · {transaction.reference}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            "text-sm font-medium tabular-nums",
            isIncoming ? "text-foreground" : "text-destructive"
          )}
        >
          {isIncoming ? "+" : "-"}
          {formatNaira(transaction.amount)}
        </span>
        <Badge variant="outline" className={cn("font-medium", status.className)}>
          {status.label}
        </Badge>
      </div>
    </div>
  )
}

export function TransactionsList({
  transactions,
  className,
}: {
  transactions: Transaction[]
  className?: string
}) {
  return (
    <Card className={className}>
      {transactions.map((transaction) => (
        <TransactionItem key={transaction.id} transaction={transaction} />
      ))}
      {transactions.length === 0 && (
        <p className="px-2 py-6 text-center text-sm text-muted-foreground">
          No transactions yet.
        </p>
      )}
    </Card>
  )
}