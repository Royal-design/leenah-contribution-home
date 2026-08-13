"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { formatDate, formatNaira } from "@/lib/format"
import { useFundContribution } from "@/hooks/queries/use-contributions"
import type { Contribution } from "@/types"

export function FundContributionDialog({
  open,
  onOpenChange,
  contribution,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contribution: Contribution
}) {
  const fundContribution = useFundContribution()

  const nextPending = contribution.schedule.find(
    (entry) => entry.status !== "paid"
  )
  const amount = nextPending?.amount ?? contribution.amount

  function onSubmit() {
    fundContribution.mutate(
      {
        id: contribution.id,
        amount,
        scheduleId: nextPending?.id,
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay contribution</DialogTitle>
          <DialogDescription>
            Fund your next {contribution.name} contribution from your wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Next due</span>
              <span className="tabular-nums">
                {nextPending ? formatDate(nextPending.dueDate) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="tabular-nums">{formatNaira(amount)}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between font-medium">
              <span>Total from wallet</span>
              <span className="tabular-nums">{formatNaira(amount)}</span>
            </div>
          </div>

          {!nextPending && (
            <p className="text-sm text-muted-foreground">
              You have no outstanding payments for this contribution.
            </p>
          )}

          <Button
            size="lg"
            disabled={!nextPending || fundContribution.isPending}
            onClick={onSubmit}
          >
            {fundContribution.isPending
              ? "Paying…"
              : `Pay ${formatNaira(amount)} from wallet`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
