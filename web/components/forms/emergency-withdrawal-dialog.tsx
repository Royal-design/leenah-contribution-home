"use client"

import { WithdrawDialog } from "@/components/forms/withdraw-dialog"

/**
 * Emergency withdrawal request entry point. Users request early access to
 * funds; an admin must review and approve before anything moves.
 */
export function EmergencyWithdrawalDialog({
  open,
  onOpenChange,
  available,
  savingsPlanId,
  contributionId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  available: number
  savingsPlanId?: string
  contributionId?: string
}) {
  return (
    <WithdrawDialog
      open={open}
      onOpenChange={onOpenChange}
      available={available}
      title="Emergency withdrawal"
      subtitle="Need access to your funds before your scheduled period? Submit an emergency request for admin review."
      mode="emergency"
      source="emergency"
      savingsPlanId={savingsPlanId}
      contributionId={contributionId}
    />
  )
}