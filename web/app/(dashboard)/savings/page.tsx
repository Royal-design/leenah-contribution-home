"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus, ArrowLeftRight, PiggyBank, Wallet, TrendingUp } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { SectionHeader } from "@/components/shared/section-header"
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card"
import { SavingsGrowthChart } from "@/components/charts/charts"
import { TransactionsList } from "@/components/transactions/transaction-list"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { PageSkeleton } from "@/components/shared/skeletons"
import { FundingDialog } from "@/components/forms/funding-dialog"
import { WithdrawDialog } from "@/components/forms/withdraw-dialog"
import { PlanCard } from "@/components/plans/plan-card"
import { useSavings, useSavingsGrowth } from "@/hooks/queries/use-savings"
import { useMySavingsPlans } from "@/hooks/queries/use-savings-plans"
import { useRecentTransactions } from "@/hooks/queries/use-transactions"
import { formatNaira } from "@/lib/format"

export default function SavingsPage() {
  const router = useRouter()
  const savings = useSavings()
  const growth = useSavingsGrowth()
  const myPlans = useMySavingsPlans({ pageSize: 100 })
  const recentTxns = useRecentTransactions(4)
  const [fundOpen, setFundOpen] = React.useState(false)
  const [withdrawOpen, setWithdrawOpen] = React.useState(false)

  if (savings.isPending || growth.isPending || myPlans.isPending) {
    return <PageSkeleton />
  }

  const plans = myPlans.data?.items ?? []
  const inPlans = plans.reduce((sum, plan) => sum + plan.totalSaved, 0)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Savings"
        description="Your savings wallet and the plans you've joined."
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
          title="Wallet balance"
          value={formatNaira(savings.data?.balance ?? 0)}
          description="Available to fund plans"
          icon={PiggyBank}
          tone="success"
        />
        <DashboardStatCard
          title="Saved in plans"
          value={formatNaira(inPlans)}
          description={`Across ${plans.length} savings plan${plans.length === 1 ? "" : "s"}`}
          icon={Wallet}
          tone="info"
        />
        <DashboardStatCard
          title="Lifetime saved"
          value={formatNaira(savings.data?.totalSaved ?? 0)}
          description="All-time savings"
          icon={TrendingUp}
          tone="warning"
        />
      </section>

      <section aria-label="Savings growth">
        <SavingsGrowthChart data={growth.data ?? []} />
      </section>

      <section aria-label="My savings plans">
        <SectionHeader
          title="My savings plans"
          description="Plans created by LCH that you've joined."
        />
        <div className="mt-4">
          {plans.length === 0 ? (
            <EmptyState
              title="No savings plans yet"
              description="Join an admin-created savings plan to start saving toward a goal automatically."
              action={{
                label: "Explore savings plans",
                onAction: () => router.push("/plans"),
              }}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  type="savings"
                  plan={plan}
                  href={`/plans/savings/${plan.id}`}
                  joined
                />
              ))}
            </div>
          )}
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
      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        available={savings.data?.balance ?? 0}
        mode="wallet"
      />
    </div>
  )
}