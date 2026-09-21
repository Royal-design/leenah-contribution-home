"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/skeletons"
import { EmptyState } from "@/components/shared/empty-state"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PlanCard, type PlanType } from "@/components/plans/plan-card"
import { useMySavingsPlans } from "@/hooks/queries/use-savings-plans"
import { useContributions } from "@/hooks/queries/use-contributions"
import type { Contribution, SavingsPlan } from "@/types"

type MyPlansTab = "all" | "savings" | "contributions"

export default function MyPlansPage() {
  const router = useRouter()
  const [tab, setTab] = React.useState<MyPlansTab>("all")
  const mySavings = useMySavingsPlans({ pageSize: 100 })
  const myContributions = useContributions({ pageSize: 100 })

  if (mySavings.isPending || myContributions.isPending) {
    return <PageSkeleton />
  }

  const savingsPlans = mySavings.data?.items ?? []
  const contributions = myContributions.data?.items ?? []

  const allItems: Array<{ type: PlanType; plan: SavingsPlan | Contribution }> = [
    ...savingsPlans.map((plan) => ({ type: "savings" as const, plan })),
    ...contributions.map((plan) => ({ type: "contribution" as const, plan })),
  ]

  const savingsOnly = allItems.filter((item) => item.type === "savings")
  const contributionsOnly = allItems.filter((item) => item.type === "contribution")

  function renderGrid(items: Array<{ type: PlanType; plan: SavingsPlan | Contribution }>) {
    if (items.length === 0) {
      return (
        <EmptyState
          title="No active plans yet"
          description="Explore available savings and contribution plans and choose one to get started."
          action={{ label: "Explore plans", onAction: () => router.push("/plans") }}
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
            joined
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="My plans" description="Track the plans you've joined and your progress.">
        <Button size="sm" render={<Link href="/plans" />}>
        Explore plans
      </Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={(value) => setTab(value as MyPlansTab)}>
        <TabsList>
          <TabsTrigger value="all">
            All
            <span className="ml-1 text-muted-foreground">{allItems.length}</span>
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
          {renderGrid(allItems)}
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