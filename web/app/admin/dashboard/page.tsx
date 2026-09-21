"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Users, PiggyBank, Wallet, Clock, UsersRound, Compass, Plus } from "lucide-react"

import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/skeletons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAdminStats } from "@/hooks/queries/use-admin"
import { formatNaira } from "@/lib/format"

export default function AdminDashboardPage() {
  const router = useRouter()
  const { data, isPending } = useAdminStats()

  if (isPending || !data) {
    return <PageSkeleton />
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Admin overview"
        description="A snapshot of your platform's health."
      >
        {/* Mobile: one primary action + a compact "New" menu */}
        <div className="flex w-full items-center gap-2 sm:hidden">
          <Button
            className="flex-1"
            render={<Link href="/admin/plans" />}
          >
            <Compass />
            Manage plans
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" aria-label="Create a new plan">
                  <Plus />
                  New
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>New plan</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/admin/savings-plans/new")}
                >
                  <PiggyBank />
                  Savings plan
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/admin/contributions/create")}
                >
                  <Users />
                  Contribution plan
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Desktop: full row of actions */}
        <div className="hidden items-center gap-2 sm:flex">
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/admin/savings-plans/new" />}
          >
            <PiggyBank />
            Create savings plan
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/admin/contributions/create" />}
          >
            <Users />
            Create contribution plan
          </Button>
          <Button size="sm" render={<Link href="/admin/plans" />}>
            <Compass />
            Manage plans
          </Button>
        </div>
      </PageHeader>

      <section aria-label="Platform stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard
          title="Total Users"
          value={data.totalUsers.toLocaleString()}
          description="Registered accounts"
          icon={Users}
          tone="info"
        />
        <DashboardStatCard
          title="Active Plans"
          value={data.activePlans.toString()}
          description={`${data.activeContributions} contributions · ${data.activeSavingsPlans} savings`}
          icon={UsersRound}
          tone="success"
        />
        <DashboardStatCard
          title="In Savings Plans"
          value={formatNaira(data.totalInSavingsPlans)}
          description={`${data.totalPlans} plans across the platform`}
          icon={PiggyBank}
          tone="warning"
        />
        <DashboardStatCard
          title="In Contribution Plans"
          value={formatNaira(data.totalInContributionPlans)}
          description="Contributed by members"
          icon={Wallet}
          tone="default"
        />
      </section>

      <section aria-label="Operations" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard
          title="Total Wallet Balance"
          value={formatNaira(data.totalFunds)}
          description="Across all users"
          icon={Wallet}
          tone="info"
        />
        <DashboardStatCard
          title="Pending Withdrawals"
          value={data.pendingWithdrawals.toString()}
          description="Requiring review"
          icon={Clock}
          tone="warning"
        />
        <DashboardStatCard
          title="Monthly Volume"
          value={formatNaira(data.monthlyVolume)}
          description="Last 30 days transactions"
          icon={Wallet}
          tone="success"
        />
      </section>

      <section aria-label="Charts" className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>New registered users over time.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.userGrowth.some((item) => item.users > 0) ? (
              <GrowthBars data={data.userGrowth.map((item) => ({ label: item.month, value: item.users }))} />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No user data yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monthly Contribution Volume</CardTitle>
            <CardDescription>Total contribution volume each month.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.contributionVolume.some((item) => item.volume > 0) ? (
              <GrowthBars
                data={data.contributionVolume.map((item) => ({ label: item.month, value: item.volume }))}
                formatValue={formatNaira}
                highlightLast
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No transaction data yet.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function GrowthBars({
  data,
  formatValue,
  highlightLast = false,
}: {
  data: Array<{ label: string; value: number }>
  formatValue?: (value: number) => string
  highlightLast?: boolean
}) {
  const max = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className="flex h-48 items-end gap-3">
      {data.map((item, index) => {
        const height = Math.round((item.value / max) * 100)
        const isLast = highlightLast && index === data.length - 1
        return (
          <div
            key={item.label}
            className="flex flex-1 flex-col items-center gap-2"
          >
            <span className="text-xs font-medium tabular-nums">
              {formatValue ? formatValue(item.value) : item.value.toLocaleString()}
            </span>
            <div
              className={
                "w-full rounded-t-md " + (isLast ? "bg-primary" : "bg-primary/30")
              }
              style={{ height: `${Math.max(height, 4)}%` }}
              role="img"
              aria-label={`${item.label}: ${formatValue ? formatValue(item.value) : item.value}`}
            />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}