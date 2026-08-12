"use client"

import * as React from "react"
import { Plus, ArrowLeftRight } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { SectionHeader } from "@/components/shared/section-header"
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card"
import { SavingsGoalCard } from "@/components/savings/savings-goal-card"
import { SavingsGrowthChart } from "@/components/charts/charts"
import { TransactionsList } from "@/components/transactions/transaction-list"
import { Button } from "@/components/ui/button"
import { PageSkeleton } from "@/components/shared/skeletons"
import { FundingDialog } from "@/components/forms/funding-dialog"
import { WithdrawDialog } from "@/components/forms/withdraw-dialog"
import { CreateGoalDialog } from "@/components/forms/create-goal-dialog"
import { useSavings, useSavingsGrowth } from "@/hooks/queries/use-savings"
import { useRecentTransactions } from "@/hooks/queries/use-transactions"
import { formatNaira } from "@/lib/format"
import { PiggyBank, Wallet, TrendingUp } from "lucide-react"

export default function SavingsPage() {
  const savings = useSavings()
  const growth = useSavingsGrowth()
  const recentTxns = useRecentTransactions(4)
  const [fundOpen, setFundOpen] = React.useState(false)
  const [withdrawOpen, setWithdrawOpen] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)

  if (savings.isPending || growth.isPending) {
    return <PageSkeleton />
  }

  const totalGoals = savings.data?.goals.reduce((sum, goal) => sum + goal.current, 0) ?? 0

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Savings"
        description="Set goals, grow your balance, and stay on track."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWithdrawOpen(true)}>
            <ArrowLeftRight />
            Withdraw
          </Button>
          <Button size="sm" onClick={() => setFundOpen(true)}>
            <Plus />
            Add money
          </Button>
        </div>
      </PageHeader>

      <section aria-label="Savings summary" className="grid gap-4 sm:grid-cols-3">
        <DashboardStatCard
          title="Total Savings"
          value={formatNaira(savings.data?.balance ?? 0)}
          description="Available balance"
          icon={PiggyBank}
          tone="success"
        />
        <DashboardStatCard
          title="Lifetime Saved"
          value={formatNaira(savings.data?.totalSaved ?? 0)}
          description={`Across ${savings.data?.goals.length ?? 0} goals`}
          icon={TrendingUp}
          tone="info"
        />
        <DashboardStatCard
          title="In Goals"
          value={formatNaira(totalGoals)}
          description="Allocated to savings goals"
          icon={Wallet}
        />
      </section>

      <section aria-label="Savings growth">
        <SavingsGrowthChart data={growth.data ?? []} />
      </section>

      <section aria-label="Savings goals">
        <SectionHeader
          title="Savings goals"
          description="Track what you're saving towards."
          action={
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              New goal
            </Button>
          }
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {savings.data?.goals.map((goal) => (
            <SavingsGoalCard key={goal.id} goal={goal} href={`/savings/${goal.id}`} />
          ))}
        </div>
      </section>

      <section aria-label="Recent savings activity">
        <SectionHeader
          title="Recent transactions"
          description="Your latest savings activity."
        />
        <div className="mt-4">
          <TransactionsList transactions={recentTxns.data ?? []} />
        </div>
      </section>

      <FundingDialog open={fundOpen} onOpenChange={setFundOpen} />
      <WithdrawDialog open={withdrawOpen} onOpenChange={setWithdrawOpen} balance={savings.data?.balance ?? 0} />
      <CreateGoalDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}