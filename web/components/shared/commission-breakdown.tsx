import { Separator } from "@/components/ui/separator"
import { formatNaira } from "@/lib/format"

export function CommissionBreakdown({
  gross,
  commission,
  fee,
  net,
  netLabel = "You'll receive",
}: {
  gross: number
  commission?: number | null
  fee?: number | null
  net?: number | null
  netLabel?: string
}) {
  const hasCommission = (commission ?? 0) > 0
  const hasFee = (fee ?? 0) > 0
  const showBreakdown = hasCommission || hasFee
  const netAmount = net ?? gross - (commission ?? 0) - (fee ?? 0)

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border bg-muted/40 p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Gross amount</span>
        <span className="tabular-nums font-medium">{formatNaira(gross)}</span>
      </div>
      {showBreakdown && hasCommission && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Commission</span>
          <span className="tabular-nums text-destructive">-{formatNaira(commission ?? 0)}</span>
        </div>
      )}
      {showBreakdown && hasFee && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Fixed fee</span>
          <span className="tabular-nums text-destructive">-{formatNaira(fee ?? 0)}</span>
        </div>
      )}
      {showBreakdown && <Separator className="my-0.5" />}
      <div className="flex items-center justify-between font-medium">
        <span>{netLabel}</span>
        <span className="tabular-nums">{formatNaira(netAmount)}</span>
      </div>
    </div>
  )
}