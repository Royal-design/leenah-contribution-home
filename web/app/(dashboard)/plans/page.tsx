"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/skeletons"
import { EmptyState } from "@/components/shared/empty-state"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PlanCard, type PlanType } from "@/components/plans/plan-card"
import { useOpenSavingsPlans, useMySavingsPlans } from "@/hooks/queries/use-savings-plans"
import { useOpenContributions } from "@/hooks/queries/use-contributions"
import { useAuthStore } from "@/stores/auth-store"
import { planHasStarted } from "@/lib/dates"
import type { Contribution, SavingsPlan } from "@/types"

type ExploreTab = "all" | "savings" | "contributions"

export default function ExplorePlansPage() {
  const currentUserId = useAuthStore((state) => state.user?.id)
  const [tab, setTab] = React.useState<ExploreTab>("all")

  const openSavings = useOpenSavingsPlans({ pageSize: 100 })
  const mineSavings = useMySavingsPlans({ pageSize: 100 })
  const openContributions = useOpenContributions({ pageSize: 100 })

  const isLoading =
    openSavings.isPending || mineSavings.isPending || openContributions.isPending

  if (isLoading) {
    return <PageSkeleton />
  }

  const joinedSavingsIds = new Set(
    (mineSavings.data?.items ?? []).map((plan) => plan.id)
  )

  const savingsPlans = (openSavings.data?.items ?? []).filter(
    (plan) => !joinedSavingsIds.has(plan.id) && !planHasStarted(plan.startDate)
  )

  const contributions = (openContributions.data?.items ?? []).filter(
    (plan) =>
      !plan.members.some((member) => member.userId === currentUserId) &&
      !planHasStarted(plan.startDate)
  )

  const allPlans: Array<{ type: PlanType; plan: SavingsPlan | Contribution }> = [
    ...savingsPlans.map((plan) => ({ type: "savings" as const, plan })),
    ...contributions.map((plan) => ({ type: "contribution" as const, plan })),
  ]

  function renderGrid(items: Array<{ type: PlanType; plan: SavingsPlan | Contribution }>) {
    if (items.length === 0) {
      return (
        <EmptyState
          title="No plans to join right now"
          description="Check back soon — new savings and contribution plans are published by LCH."
        />
      )
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ type, plan }) => (
          <PlanCard
            key={`${type}-${plan.id}`}
            type={type}
            plan={plan}
            href={type === "savings" ? `/plans/savings/${plan.id}` : `/contributions/${plan.id}`}
          />
        ))}
      </div>
    )
  }

  const savingsOnly = allPlans.filter((item) => item.type === "savings")
  const contributionsOnly = allPlans.filter((item) => item.type === "contribution")

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Explore plans"
        description="Discover savings and contribution plans created by LCH, then join the ones that fit you."
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as ExploreTab)}>
        <TabsList>
          <TabsTrigger value="all">
            All
            <span className="ml-1 text-muted-foreground">{allPlans.length}</span>
          </TabsTrigger>
          <TabsTrigger value="savings">
            Savings
            <span className="ml-1 text-muted-foreground">{savingsOnly.length}</span>
          </TabsTrigger>
          <TabsTrigger value="contributions">
            Contributions
            <span className="ml-1 text-muted-foreground">{contributionsOnly.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {allPlans.length > 0 && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="border-transparent bg-primary/10 text-primary">
                Savings
              </Badge>
              <span>fixed monthly plans you save towards</span>
              <span className="mx-1 text-muted-foreground/50">·</span>
              <Badge variant="outline" className="border-transparent bg-info/15 text-info">
                Contributions
              </Badge>
              <span>group circles with scheduled payouts</span>
            </div>
          )}
          {renderGrid(allPlans)}
        </TabsContent>

        <TabsContent value="savings" className="mt-6">
          {renderGrid(savingsOnly)}
        </TabsContent>

        <TabsContent value="contributions" className="mt-6">
          {renderGrid(contributionsOnly)}
        </TabsContent>
      </Tabs>
    </div>
  )
}