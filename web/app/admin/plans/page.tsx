"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, PiggyBank, Users, Search } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/skeletons"
import { SectionHeader } from "@/components/shared/section-header"
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/shared/status-badge"
import { useAdminStats } from "@/hooks/queries/use-admin"
import { useAdminSavingsPlans } from "@/hooks/queries/use-savings-plans"
import { useAdminContributions } from "@/hooks/queries/use-admin"
import { formatDate, formatNaira } from "@/lib/format"
import { formatDurationMonths } from "@/lib/dates"
import type { Contribution, SavingsPlan } from "@/types"

type PlansTab = "savings" | "contributions"

const PAGE_SIZE = 8

function useDebouncedSearch() {
  const [search, setSearch] = React.useState("")
  const [debounced, setDebounced] = React.useState("")
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(timer)
  }, [search])
  return { search, setSearch, debounced }
}

export default function AdminPlansPage() {
  const [tab, setTab] = React.useState<PlansTab>("savings")
  const { data: stats, isPending: statsPending } = useAdminStats()

  if (statsPending || !stats) {
    return <PageSkeleton />
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Plans"
        description="Create and manage the savings and contribution plans published to users."
      >
        <Button variant="outline" size="sm" render={<Link href="/admin/savings-plans/new" />}>
          <PiggyBank />
          Create savings plan
        </Button>
        <Button size="sm" render={<Link href="/admin/contributions/create" />}>
          <Users />
          Create contribution plan
        </Button>
      </PageHeader>

      <section aria-label="Plans overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard
          title="Total plans"
          value={stats.totalPlans.toString()}
          description="Savings + contribution"
          icon={PiggyBank}
          tone="info"
        />
        <DashboardStatCard
          title="Active plans"
          value={stats.activePlans.toString()}
          description="Running right now"
          icon={Users}
          tone="success"
        />
        <DashboardStatCard
          title="In savings plans"
          value={formatNaira(stats.totalInSavingsPlans)}
          description="Member savings collected"
          icon={PiggyBank}
          tone="warning"
        />
        <DashboardStatCard
          title="In contribution plans"
          value={formatNaira(stats.totalInContributionPlans)}
          description="Contributed by members"
          icon={Users}
          tone="default"
        />
      </section>

      <Tabs value={tab} onValueChange={(value) => setTab(value as PlansTab)}>
        <TabsList>
          <TabsTrigger value="savings">Savings plans</TabsTrigger>
          <TabsTrigger value="contributions">Contribution plans</TabsTrigger>
        </TabsList>

        <TabsContent value="savings" className="mt-6">
          <SavingsPlansSection />
        </TabsContent>

        <TabsContent value="contributions" className="mt-6">
          <ContributionsSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SavingsPlansSection() {
  const [page, setPage] = React.useState(1)
  const { search, setSearch, debounced } = useDebouncedSearch()
  const { data, isPending } = useAdminSavingsPlans({
    page,
    pageSize: PAGE_SIZE,
    search: debounced || undefined,
  })

  const items = data?.items ?? []

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Savings plans"
        description="Fixed plans members join and save toward."
        action={
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Search plans…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              className="max-w-56 pl-8"
              aria-label="Search savings plans"
            />
          </div>
        }
      />

      {isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center">
          <p className="text-sm font-medium">No savings plans yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first savings plan to publish it to users.
          </p>
          <Button size="sm" className="mt-4" render={<Link href="/admin/savings-plans/new" />}>
            <Plus />
            Create savings plan
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl bg-card shadow-sm">
            <TableShell
              headers={["Plan", "Amount", "Duration", "Progress", "Members", "Starts", "Status"]}
            >
              {items.map((plan: SavingsPlan) => (
                <tr key={plan.id} className="border-b text-sm last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/savings-plans/${plan.id}`}
                      className="font-medium hover:text-primary hover:underline underline-offset-4"
                    >
                      {plan.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatNaira(plan.amount)} / {plan.frequency}
                  </td>
                  <td className="px-4 py-3">{formatDurationMonths(plan.durationMonths)}</td>
                  <td className="px-4 py-3 tabular-nums">{plan.progress}%</td>
                  <td className="px-4 py-3">{plan.enrollCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(plan.startDate)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={plan.status} />
                  </td>
                </tr>
              ))}
            </TableShell>
          </div>
          <Pagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}

function ContributionsSection() {
  const [page, setPage] = React.useState(1)
  const { search, setSearch, debounced } = useDebouncedSearch()
  const { data, isPending } = useAdminContributions({
    page,
    pageSize: PAGE_SIZE,
    search: debounced || undefined,
  })

  const items = data?.items ?? []

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Contribution plans"
        description="Group circles members join and contribute toward."
        action={
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Search plans…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              className="max-w-56 pl-8"
              aria-label="Search contribution plans"
            />
          </div>
        }
      />

      {isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center">
          <p className="text-sm font-medium">No contribution plans yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first contribution plan to let members join a circle.
          </p>
          <Button size="sm" className="mt-4" render={<Link href="/admin/contributions/create" />}>
            <Plus />
            Create contribution plan
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl bg-card shadow-sm">
            <TableShell
              headers={["Plan", "Amount", "Rounds", "Progress", "Members", "Starts", "Status"]}
            >
              {items.map((plan: Contribution) => (
                <tr key={plan.id} className="border-b text-sm last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/contributions/${plan.id}`}
                      className="font-medium hover:text-primary hover:underline underline-offset-4"
                    >
                      {plan.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {formatNaira(plan.amount)} / {plan.frequency}
                  </td>
                  <td className="px-4 py-3">
                    {plan.rounds} {plan.rounds === 1 ? "round" : "rounds"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{plan.progress}%</td>
                  <td className="px-4 py-3">{plan.members.length}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(plan.startDate)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={plan.status} />
                  </td>
                </tr>
              ))}
            </TableShell>
          </div>
          <Pagination
            page={data?.page ?? 1}
            totalPages={data?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  )
}

function TableShell({
  headers,
  children,
}: {
  headers: string[]
  children: React.ReactNode
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}