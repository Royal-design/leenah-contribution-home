"use client"

import * as React from "react"
import Link from "next/link"
import {
  Wallet,
  PiggyBank,
  Users,
  CalendarClock,
  Plus,
  ArrowLeftRight,
  Target,
} from "lucide-react"

import { BalanceSummary } from "@/components/dashboard/balance-summary"
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card"
import {
  ContributionActivityChart,
  SavingsGrowthChart,
} from "@/components/charts/charts"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { TransactionsList } from "@/components/transactions/transaction-list"
import { ContributionCard } from "@/components/contributions/contribution-card"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageSkeleton } from "@/components/shared/skeletons"
import { SectionHeader } from "@/components/shared/section-header"
import { FundingDialog } from "@/components/forms/funding-dialog"
import { WithdrawDialog } from "@/components/forms/withdraw-dialog"
import { useAuthStore } from "@/stores/auth-store"
import { useContributions } from "@/hooks/queries/use-contributions"
import { useSavings, useSavingsGrowth } from "@/hooks/queries/use-savings"
import { useRecentTransactions } from "@/hooks/queries/use-transactions"
import { formatNaira, formatShortMonth } from "@/lib/format"

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const contributions = useContributions()
  const savings = useSavings()
  const growth = useSavingsGrowth()
  const recentTxns = useRecentTransactions(5)
  const [fundingOpen, setFundingOpen] = React.useState(false)
  const [withdrawOpen, setWithdrawOpen] = React.useState(false)

  const isLoading = contributions.isPending || savings.isPending || growth.isPending

  if (isLoading) {
    return <PageSkeleton />
  }

  const contributionItems = contributions.data?.items ?? []

  const activeContributionsList = contributionItems.filter(
    (contribution) => contribution.status !== "completed"
  )
  const totalContributions = contributionItems.reduce(
    (sum, contribution) => sum + contribution.totalContributed,
    0
  )
  const totalBalance = (savings.data?.balance ?? 0) + totalContributions

  const next = contributionItems
    .filter((contribution) => contribution.status !== "completed")
    .sort(
      (a, b) =>
        new Date(a.nextPaymentDate).getTime() - new Date(b.nextPaymentDate).getTime()
    )[0]

  const contributionActivity = contributionItems.map((contribution) => ({
    month: formatShortMonth(contribution.startDate),
    contributions: contribution.totalContributed,
  }))

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        title={`Good ${getGreeting()}, ${user?.firstName ?? ""}`}
        description="Here's what's happening with your money today."
      />

      {/* 1. Financial summary */}
      <section aria-label="Financial summary">
        <BalanceSummary
          balance={savings.data?.balance ?? 0}
          wallet={savings.data?.totalSaved ?? 0}
          savings={savings.data?.totalWithdrawn ?? 0}
          activePlanCount={activeContributionsList.length}
          activePlanAmount={totalContributions}
          onDeposit={() => setFundingOpen(true)}
          onWithdraw={() => setWithdrawOpen(true)}
        />
      </section>

      {/* 2. Financial health */}
      <section aria-label="Financial health">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardStatCard
            title="Reserved"
            value={formatNaira(savings.data?.reserved ?? 0)}
            description="Locked for pending withdrawals"
            icon={PiggyBank}
            tone="warning"
          />
          <DashboardStatCard
            title="Lifetime saved"
            value={formatNaira(savings.data?.totalSaved ?? 0)}
            description="Total savings made"
            icon={Wallet}
            tone="success"
          />
          <DashboardStatCard
            title="Next contribution"
            value={formatNaira(next?.amount ?? 0)}
            description={
              next && next.nextPaymentDate
                ? `Due ${next.nextPaymentDate.split("T")[0]}`
                : "No due payments"
            }
            icon={CalendarClock}
            tone="warning"
          />
          <DashboardStatCard
            title="In contributions"
            value={formatNaira(totalContributions)}
            description={`${activeContributionsList.length} active ${activeContributionsList.length === 1 ? "plan" : "plans"}`}
            icon={Users}
            tone="info"
          />
        </div>
      </section>

      {/* 3. Quick actions */}
      <section aria-label="Quick actions">
        <QuickActions
          actions={[
            { label: "Add Money", icon: Plus, onClick: () => setFundingOpen(true) },
            { label: "Start Saving", icon: Target, href: "/savings" },
            { label: "Join Contribution", icon: Users, href: "/join-contribution" },
            { label: "Withdraw", icon: ArrowLeftRight, href: "/savings" },
          ]}
        />
      </section>

      {/* 4. Plan progress */}
      {activeContributionsList.length > 0 && (
        <section aria-label="Active plans">
          <SectionHeader
            title="Plan progress"
            description="Your contributions at a glance."
            action={
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/contributions" />}
              >
                View all
              </Button>
            }
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeContributionsList.slice(0, 3).map((contribution) => (
              <ContributionCard key={contribution.id} contribution={contribution} />
            ))}
          </div>
        </section>
      )}

      {/* 5. Recent activity */}
      <section aria-label="Recent activity">
        <SectionHeader
          title="Recent activity"
          description="Your latest transactions."
          action={
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/transactions" />}
            >
              View all
            </Button>
          }
        />
        <div className="mt-4">
          <TransactionsList transactions={recentTxns.data ?? []} />
        </div>
      </section>

      {/* 6. Charts / analytics */}
      {next && (
        <section aria-label="Upcoming contribution" className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming contribution</CardTitle>
              <CardDescription>{next.name}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-end justify-between gap-3">
                <p className="text-2xl font-semibold tabular-nums sm:text-3xl">
                  {formatNaira(next.amount)}
                </p>
                <Badge className="border-transparent bg-primary/10 text-primary dark:bg-primary/20">
                  {next.nextPaymentDate.split("T")[0]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Next payment due{" "}
                <span className="font-medium text-foreground">
                  {next.nextPaymentDate.split("T")[0]}
                </span>
              </p>
              <Button
                variant="secondary"
                className="w-fit"
                render={<Link href={`/contributions/${next.id}`} />}
              >
                View details
              </Button>
            </CardContent>
          </Card>

          <div className="flex flex-col">
            <SectionHeader
              title="Savings growth"
              description="Your savings balance over time."
            />
            <div className="mt-4 flex-1">
              <SavingsGrowthChart data={growth.data ?? []} />
            </div>
          </div>
        </section>
      )}

      <section aria-label="Analytics" className="grid gap-4 xl:grid-cols-2">
        <ContributionActivityChart data={contributionActivity} />
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