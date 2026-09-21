"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Wallet, CalendarClock, Compass, ArrowLeftRight, PiggyBank, Target } from "lucide-react"

import { BalanceSummary } from "@/components/dashboard/balance-summary"
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { TransactionsList } from "@/components/transactions/transaction-list"
import { PlanCard } from "@/components/plans/plan-card"
import { PageHeader } from "@/components/shared/page-header"
import { SectionHeader } from "@/components/shared/section-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { PageSkeleton } from "@/components/shared/skeletons"
import { FundingDialog } from "@/components/forms/funding-dialog"
import { WithdrawDialog } from "@/components/forms/withdraw-dialog"
import { useAuthStore } from "@/stores/auth-store"
import { useContributions, useOpenContributions } from "@/hooks/queries/use-contributions"
import { useSavings } from "@/hooks/queries/use-savings"
import { useMySavingsPlans, useOpenSavingsPlans } from "@/hooks/queries/use-savings-plans"
import { useRecentTransactions } from "@/hooks/queries/use-transactions"
import { formatDate, formatNaira } from "@/lib/format"
import { planHasStarted } from "@/lib/dates"

export default function DashboardPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const savings = useSavings()
  const mySavingsPlans = useMySavingsPlans({ pageSize: 100 })
  const contributions = useContributions({ pageSize: 100 })
  const openSavings = useOpenSavingsPlans({ pageSize: 3 })
  const openContributions = useOpenContributions({ pageSize: 3 })
  const recentTxns = useRecentTransactions(5)
  const [fundingOpen, setFundingOpen] = React.useState(false)
  const [withdrawOpen, setWithdrawOpen] = React.useState(false)

  const isLoading =
    savings.isPending ||
    mySavingsPlans.isPending ||
    contributions.isPending ||
    openSavings.isPending ||
    openContributions.isPending

  if (isLoading) {
    return <PageSkeleton />
  }

  const joinedSavings = mySavingsPlans.data?.items ?? []
  const joinedContributions = contributions.data?.items ?? []
  const activeSavings = joinedSavings.filter((plan) => plan.status !== "completed")
  const activeContributions = joinedContributions.filter((plan) => plan.status !== "completed")

  const inSavingsPlans = activeSavings.reduce((sum, plan) => sum + plan.totalSaved, 0)
  const inContributions = activeContributions.reduce(
    (sum, plan) => sum + plan.totalContributed,
    0
  )
  const totalInPlans = inSavingsPlans + inContributions
  const activePlanCount = activeSavings.length + activeContributions.length

  const availableSavings = (openSavings.data?.items ?? []).filter(
    (plan) => !planHasStarted(plan.startDate)
  )
  const availableContributions = (openContributions.data?.items ?? []).filter(
    (plan) =>
      !plan.members.some((member) => member.userId === user?.id) &&
      !planHasStarted(plan.startDate)
  )

  const upcomingPayments: Array<{ amount: number; dueDate: string }> = [
    ...activeContributions
      .filter((plan) => plan.nextPaymentDate)
      .map((plan) => ({ amount: plan.amount, dueDate: plan.nextPaymentDate })),
    ...activeSavings
      .filter((plan) => plan.enrollment?.nextPaymentDate || plan.nextPaymentDate)
      .map((plan) => ({
        amount: plan.amount,
        dueDate: (plan.enrollment?.nextPaymentDate ?? plan.nextPaymentDate) as string,
      })),
  ]
  const nextPayment = upcomingPayments.sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  )[0]

  const myPlanItems = [
    ...activeSavings.map((plan) => ({ type: "savings" as const, plan })),
    ...activeContributions.map((plan) => ({ type: "contribution" as const, plan })),
  ].slice(0, 3)

  const availableItems = [
    ...availableSavings.map((plan) => ({ type: "savings" as const, plan })),
    ...availableContributions.map((plan) => ({ type: "contribution" as const, plan })),
  ].slice(0, 3)

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title={`Good ${getGreeting()}, ${user?.firstName ?? ""}`}
        description="Here's what you can do with your money today."
      >
        <Button size="sm" render={<Link href="/plans" />}>
          <Compass />
          Explore plans
        </Button>
      </PageHeader>

      {/* Financial summary */}
      <section aria-label="Financial summary">
        <BalanceSummary
          balance={savings.data?.balance ?? 0}
          wallet={savings.data?.totalSaved ?? 0}
          savings={inSavingsPlans}
          activePlanCount={activePlanCount}
          activePlanAmount={totalInPlans}
          onDeposit={() => setFundingOpen(true)}
          onWithdraw={() => setWithdrawOpen(true)}
        />
      </section>

      {/* Primary actions */}
      <section aria-label="Quick actions">
        <QuickActions
          actions={[
            { label: "Explore plans", icon: Compass, href: "/plans", description: "See what you can join" },
            { label: "My plans", icon: Target, href: "/my-plans", description: "Track your progress" },
            { label: "Add money", icon: ArrowLeftRight, onClick: () => setFundingOpen(true), description: "Top up your wallet" },
            { label: "Withdraw", icon: PiggyBank, onClick: () => setWithdrawOpen(true), description: "Move funds out" },
          ]}
        />
      </section>

      {/* Key metrics */}
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard
          title="Total in plans"
          value={formatNaira(totalInPlans)}
          description={`${activePlanCount} active ${activePlanCount === 1 ? "plan" : "plans"}`}
          icon={Wallet}
          tone="success"
        />
        <DashboardStatCard
          title="Savings plans"
          value={activeSavings.length.toString()}
          description={formatNaira(inSavingsPlans) + " saved"}
          icon={PiggyBank}
          tone="info"
        />
        <DashboardStatCard
          title="Next payment"
          value={formatNaira(nextPayment?.amount ?? 0)}
          description={
            nextPayment ? `Due ${formatDate(nextPayment.dueDate)}` : "No due payments"
          }
          icon={CalendarClock}
          tone="warning"
        />
        <DashboardStatCard
          title="Wallet balance"
          value={formatNaira(savings.data?.balance ?? 0)}
          description="Available to fund plans"
          icon={Wallet}
          tone="default"
        />
      </section>

      {/* My plans */}
      <section aria-label="My plans">
        <SectionHeader
          title="My plans"
          description="Your active savings and contribution plans."
          action={
            <Button variant="ghost" size="sm" render={<Link href="/my-plans" />}>
              View all
            </Button>
          }
        />
        <div className="mt-4">
          {myPlanItems.length === 0 ? (
            <EmptyState
              title="No active plans yet"
              description="Join a savings or contribution plan to start growing your money."
              action={{ label: "Explore plans", onAction: () => router.push("/plans") }}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myPlanItems.map(({ type, plan }) => (
                <PlanCard
                  key={`${type}-${plan.id}`}
                  type={type}
                  plan={plan}
                  href={type === "savings" ? `/plans/savings/${plan.id}` : `/contributions/${plan.id}`}
                  joined
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Available plans */}
      {availableItems.length > 0 && (
        <section aria-label="Available plans">
          <SectionHeader
            title="Available to join"
            description="New plans published by LCH."
            action={
              <Button variant="ghost" size="sm" render={<Link href="/plans" />}>
                Explore all
              </Button>
            }
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableItems.map(({ type, plan }) => (
              <PlanCard
                key={`${type}-${plan.id}`}
                type={type}
                plan={plan}
                href={type === "savings" ? `/plans/savings/${plan.id}` : `/contributions/${plan.id}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent activity */}
      <section aria-label="Recent activity">
        <SectionHeader
          title="Recent activity"
          description="Your latest transactions."
          action={
            <Button variant="ghost" size="sm" render={<Link href="/transactions" />}>
              View all
            </Button>
          }
        />
        <div className="mt-4">
          <TransactionsList transactions={recentTxns.data ?? []} />
        </div>
      </section>

      <FundingDialog open={fundingOpen} onOpenChange={setFundingOpen} />
      <WithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        balance={savings.data?.balance ?? 0}
      />
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "morning"
  if (hour < 17) return "afternoon"
  return "evening"
}