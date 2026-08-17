"use client"

import { Users, PiggyBank, Wallet, Clock, ArrowLeftRight } from "lucide-react"

import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/skeletons"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAdminStats } from "@/hooks/queries/use-admin"
import { formatNaira } from "@/lib/format"

export default function AdminDashboardPage() {
  const { data, isPending } = useAdminStats()

  if (isPending || !data) {
    return <PageSkeleton />
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Admin overview"
        description="A snapshot of your platform's health."
      />

      <section aria-label="Platform stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard
          title="Total Users"
          value={data.totalUsers.toLocaleString()}
          description="Registered accounts"
          icon={Users}
          tone="info"
        />
        <DashboardStatCard
          title="Active Contributions"
          value={data.activeContributions.toString()}
          description="Plans currently running"
          icon={PiggyBank}
          tone="success"
        />
        <DashboardStatCard
          title="Total Wallet Balance"
          value={formatNaira(data.totalFunds)}
          description="Across all users"
          icon={Wallet}
        />
        <DashboardStatCard
          title="Pending Withdrawals"
          value={data.pendingWithdrawals.toString()}
          description="Requiring review"
          icon={Clock}
          tone="warning"
        />
      </section>

      <section aria-label="Volume" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard
          title="Monthly Volume"
          value={formatNaira(data.monthlyVolume)}
          description="Last 30 days transactions"
          icon={ArrowLeftRight}
          tone="info"
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