"use client"

import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCommissionSummary } from "@/hooks/queries/use-admin"
import { formatNaira } from "@/lib/format"

const typeLabels: Record<string, string> = {
  contribution: "Contribution",
  savings: "Savings",
  funding: "Funding",
  withdrawal: "Withdrawal",
}

const sourceLabels: Record<string, string> = {
  wallet: "Wallet",
  savings_plan: "Savings plan",
  contribution: "Contribution",
  emergency: "Emergency",
  admin: "Admin payout",
  webhook: "Webhook",
  payout: "Payout",
  reversal: "Reversal",
}

export function CommissionRevenueCard() {
  const { data, isPending } = useCommissionSummary()

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Commission revenue{" "}
          <Link href="/admin/transactions" className="ml-1 text-xs font-normal text-primary hover:underline">
            View ledger
          </Link>
        </CardTitle>
        <CardDescription>Authoritative figures from the transaction ledger.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isPending || !data ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-40 rounded-xl" />
            <Skeleton className="h-8 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{formatNaira(data.total)}</p>
              <p className="text-xs text-muted-foreground">Total commission collected</p>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              {data.byType.length === 0 && (
                <p className="text-sm text-muted-foreground">No commission recorded yet.</p>
              )}
              {data.byType.map((entry) => (
                <div key={entry.type} className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {typeLabels[entry.type] ?? entry.type}
                  </span>
                  <span className="font-medium tabular-nums">{formatNaira(entry.total)}</span>
                </div>
              ))}
              {data.bySource.length > 0 && (
                <div className="mt-2 border-t pt-2">
                  {data.bySource.map((entry) => (
                    <div key={entry.source ?? "none"} className="flex items-center justify-between py-0.5">
                      <span className="text-muted-foreground">
                        {sourceLabels[entry.source ?? ""] ?? entry.source ?? "Other"}
                      </span>
                      <span className="tabular-nums">{formatNaira(entry.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}