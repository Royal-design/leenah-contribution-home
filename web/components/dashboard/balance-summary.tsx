import { ArrowDownToLine, ArrowUpFromLine, PiggyBank, Target, Users, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatNaira } from "@/lib/format"

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof PiggyBank
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 bg-muted/30 px-3.5 py-3 sm:px-3.5 sm:py-3.5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  )
}

export function BalanceSummary({
  balance,
  wallet,
  savings,
  activePlanCount,
  activePlanAmount,
  onDeposit,
  onWithdraw,
}: {
  balance: number
  wallet?: number
  savings?: number
  activePlanCount?: number
  activePlanAmount?: number
  onDeposit?: () => void
  onWithdraw?: () => void
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="size-4" aria-hidden="true" />
            <span className="text-sm">Available balance</span>
          </div>
          <p className="text-[2rem] leading-tight font-semibold tracking-tight tabular-nums sm:text-4xl">
            {formatNaira(balance)}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your wallet, savings and contribution funds.
          </p>
        </div>

        <div className="flex gap-2.5 sm:gap-3">
          <Button className="h-13 min-w-0 flex-1" onClick={onDeposit}>
            <ArrowDownToLine aria-hidden="true" />
            Deposit
          </Button>
          <Button
            variant="secondary"
            className="h-13 min-w-0 flex-1"
            onClick={onWithdraw}
          >
            <ArrowUpFromLine aria-hidden="true" />
            Withdraw
          </Button>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <MiniStat icon={PiggyBank} label="Wallet" value={formatNaira(wallet ?? 0)} />
          <MiniStat icon={Target} label="Savings" value={formatNaira(savings ?? 0)} />
          <MiniStat
            icon={Users}
            label="Active plans"
            value={
              activePlanCount
                ? `${activePlanCount} · ${formatNaira(activePlanAmount ?? 0)}`
                : "0 plans"
            }
          />
        </div>
      </CardContent>
    </Card>
  )
}