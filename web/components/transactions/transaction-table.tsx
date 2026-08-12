import type { ColumnDef } from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import {
  transactionStatusMeta,
  transactionTypeMeta,
} from "@/components/transactions/transaction-list"
import { cn } from "@/lib/utils"
import { formatDate, formatNaira } from "@/lib/format"
import type { Transaction } from "@/types"

export function TransactionTable({
  transactions,
}: {
  transactions: Transaction[]
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
  ]

  return <DataTable columns={columns} data={transactions} />
}