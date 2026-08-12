import type { ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import { Undo2 } from "lucide-react"
import {
  transactionStatusMeta,
  transactionTypeMeta,
} from "@/components/transactions/transaction-list"
import { cn } from "@/lib/utils"
import { formatDate, formatNaira } from "@/lib/format"
import type { Transaction } from "@/types"

export function TransactionTable({
  transactions,
  onRevert,
}: {
  transactions: Transaction[]
  onRevert?: (transaction: Transaction) => void
}) {
  const columns: ColumnDef<Transaction>[] = [
    {
      accessorKey: "description",
      header: "Transaction",
      cell: ({ row }) => (
        <p className="max-w-[16rem] truncate font-medium">
          {row.original.description}
        </p>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-normal capitalize">
          {transactionTypeMeta[row.original.type].label}
        </Badge>
      ),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.date)}
        </span>
      ),
    },
    {
      accessorKey: "reference",
      header: "Reference",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.reference}</span>
      ),
    },
    {
      accessorKey: "amount",
      header: () => <span>Amount</span>,
      cell: ({ row }) => {
        const isIncoming = row.original.type !== "withdrawal"
        return (
          <span
            className={cn(
              "font-medium tabular-nums",
              isIncoming ? "text-success" : "text-destructive"
            )}
          >
            {isIncoming ? "+" : "-"}
            {formatNaira(row.original.amount)}
          </span>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={cn("font-medium", transactionStatusMeta[row.original.status].className)}
        >
          {transactionStatusMeta[row.original.status].label}
        </Badge>
      ),
    },
    ...(onRevert
      ? [
          {
            id: "actions",
            header: "Actions",
            meta: { align: "right" as const },
            cell: ({ row }: { row: { original: Transaction } }) =>
              row.original.status === "failed" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRevert(row.original)}
                >
                  <Undo2 />
                  Revert
                </Button>
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <DataTable
      columns={columns}
      data={transactions}
      mobileCard={({ original }) => {
        const type = transactionTypeMeta[original.type]
        const status = transactionStatusMeta[original.status]
        const isIncoming = original.type !== "withdrawal"
        return (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{original.description}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {formatDate(original.date)} · {original.reference}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-sm font-semibold tabular-nums",
                  isIncoming ? "text-success" : "text-destructive"
                )}
              >
                {isIncoming ? "+" : "-"}
                {formatNaira(original.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Badge variant="outline" className="font-normal capitalize">
                {type.label}
              </Badge>
              <div className="flex items-center gap-2">
                {original.status === "failed" && onRevert && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRevert(original)}
                  >
                    <Undo2 />
                    Revert
                  </Button>
                )}
                <Badge
                  variant="outline"
                  className={cn("font-medium", status.className)}
                >
                  {status.label}
                </Badge>
              </div>
            </div>
          </div>
        )
      }}
    />
  )
}