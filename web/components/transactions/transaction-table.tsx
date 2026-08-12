import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
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
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Transaction</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => {
          const type = transactionTypeMeta[transaction.type]
          const status = transactionStatusMeta[transaction.status]
          const isIncoming = transaction.type !== "withdrawal"

          return (
            <TableRow key={transaction.id}>
              <TableCell className="max-w-[16rem]">
                <p className="truncate font-medium">{transaction.description}</p>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal capitalize">
                  {type.label}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(transaction.date)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {transaction.reference}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-medium tabular-nums",
                  isIncoming ? "text-success" : "text-destructive"
                )}
              >
                {isIncoming ? "+" : "-"}
                {formatNaira(transaction.amount)}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn("font-medium", status.className)}
                >
                  {status.label}
                </Badge>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}