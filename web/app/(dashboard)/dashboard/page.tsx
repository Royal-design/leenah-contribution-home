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
import { useAuthStore } from "@/stores/auth-store"
import { useContributions } from "@/hooks/queries/use-contributions"
import { useSavings, useSavingsGrowth } from "@/hooks/queries/use-savings"
import { useRecentTransactions } from "@/hooks/queries/use-transactions"
import { dashboardOverview } from "@/lib/mock/dashboard"
import { formatDate, formatNaira, relativeDate } from "@/lib/format"

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const contributions = useContributions()
  const savings = useSavings()
  const growth = useSavingsGrowth()
  const recentTxns = useRecentTransactions(5)
  const [fundingOpen, setFundingOpen] = React.useState(false)

  const isLoading = contributions.isPending || savings.isPending || growth.isPending

  if (isLoading) {
    return <PageSkeleton />
  }

  const data = dashboardOverview
  const activeContributionsList = (contributions.data ?? []).filter(
    (contribution) => contribution.status !== "completed"
  )
  const totalContributions = (contributions.data ?? []).reduce(
    (sum, contribution) => sum + contribution.totalContributed,
    0
  )
  const totalBalance = (savings.data?.balance ?? 0) + totalContributions
  const next = data.upcomingContribution

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Good ${getGreeting()}, ${user?.firstName ?? ""}`}
        description="Here's what's happening with your money today."
      />

      <section
        aria-label="Financial overview"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <DashboardStatCard
          title="Total Balance"
          value={formatNaira(totalBalance)}
          description="Wallet + active contributions"
          icon={Wallet}
        />
        <DashboardStatCard
          title="Total Savings"
          value={formatNaira(savings.data?.balance ?? 0)}
          description="Available in your wallet"
          icon={PiggyBank}
          tone="success"
        />
        <DashboardStatCard
          title="Active Contributions"
          value={formatNaira(totalContributions)}
          description={`${activeContributionsList.length} active ${activeContributionsList.length === 1 ? "plan" : "plans"}`}
          icon={Users}
          tone="info"
        />
        <DashboardStatCard
          title="Next Contribution"
          value={formatNaira(next?.amount ?? 0)}
          description={
            next ? `Due ${relativeDate(next.nextPaymentDate)}` : "No due payments"
          }
          icon={CalendarClock}
          tone="warning"
        />
      </section>

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

      <section aria-label="Charts" className="grid gap-4 xl:grid-cols-2">
        <SavingsGrowthChart data={growth.data ?? data.savingsGrowth} />
        <ContributionActivityChart data={data.contributionActivity} />
      </section>

      {activeContributionsList.length > 0 && (
        <section aria-label="Active plans">
          <SectionHeader
            title="Active plans"
            description="Your contributions at a glance."
            action={
              <Button
                variant="outline"
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

      <section className="grid gap-6 lg:grid-cols-2">
        {next && (
          <Card>
            <CardHeader>
              <CardTitle>Upcoming contribution</CardTitle>
              <CardDescription>{next.name}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-end justify-between gap-3">
                <p className="text-3xl font-semibold tabular-nums">
                  {formatNaira(next.amount)}
                </p>
                <Badge className="border-transparent bg-primary/10 text-primary dark:bg-primary/20">
                  {relativeDate(next.nextPaymentDate)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Next payment due{" "}
                <span className="font-medium text-foreground">
                  {formatDate(next.nextPaymentDate)}
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
        )}

        <div className="flex flex-col gap-4">
          <SectionHeader
            title="Recent transactions"
            description="Your latest activity."
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
          <TransactionsList transactions={recentTxns.data ?? []} />
        </div>
      </section>

      <FundingDialog open={fundingOpen} onOpenChange={setFundingOpen} />
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "morning"
  if (hour < 17) return "afternoon"
  return "evening"
}