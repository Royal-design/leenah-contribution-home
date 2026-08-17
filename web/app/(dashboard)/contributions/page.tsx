"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Plus, UserPlus, Users, Wallet } from "lucide-react"

import { ContributionCard } from "@/components/contributions/contribution-card"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/skeletons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Pagination } from "@/components/ui/pagination"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  useContributions,
  useOpenContributions,
  useJoinContribution,
} from "@/hooks/queries/use-contributions"
import { useAuthStore } from "@/stores/auth-store"
import { formatDate, formatNaira } from "@/lib/format"
import type { Contribution } from "@/types"

const PAGE_SIZE = 9

type ContributionsTab = "active" | "upcoming" | "completed" | "open-active" | "open-upcoming"

function ContributionGrid({
  items,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: {
  items: Contribution[]
  emptyTitle: string
  emptyDescription: string
  emptyAction?: { label: string; onAction: () => void }
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((contribution) => (
        <ContributionCard key={contribution.id} contribution={contribution} />
      ))}
    </div>
  )
}

export default function ContributionsPage() {
  const router = useRouter()
  const currentUserId = useAuthStore((state) => state.user?.id)
  const [tab, setTab] = React.useState<ContributionsTab>("active")
  const [page, setPage] = React.useState(1)

  const joined = useContributions({ page, pageSize: PAGE_SIZE })
  const available = useOpenContributions({ page, pageSize: PAGE_SIZE })
  const joinContribution = useJoinContribution()

  const joiningId = joinContribution.isPending ? joinContribution.variables : null

  if (joined.isPending || available.isPending) {
    return <PageSkeleton />
  }

  const joinedItems = joined.data?.items ?? []
  const currentJoinedIds = new Set(joinedItems.map((c) => c.id))
  const availableItems = (available.data?.items ?? []).filter(
    (plan) =>
      !currentJoinedIds.has(plan.id) &&
      !plan.members.some((member) => member.userId === currentUserId)
  )

  const activeItems = joinedItems.filter((c) => c.status === "active")
  const upcomingItems = joinedItems.filter((c) => c.status === "upcoming")
  const completedItems = joinedItems.filter((c) => c.status === "completed")
  const openActiveItems = availableItems.filter((c) => c.status === "active")
  const openUpcomingItems = availableItems.filter((c) => c.status === "upcoming")

  function handleJoin(planId: string) {
    joinContribution.mutate(planId, {
      onSuccess: () => router.push(`/contributions/${planId}`),
    })
  }

  function switchTab(value: string) {
    setPage(1)
    setTab(value as ContributionsTab)
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Contributions"
        description="Join contribution circles and track your progress."
      >
        <Button size="sm" onClick={() => switchTab("open-active")}>
          <Plus />
          Join a contribution
        </Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={switchTab}>
        <TabsList>
          <TabsTrigger value="active">
            Active
            {activeItems.length > 0 && (
              <span className="ml-1 text-muted-foreground">{activeItems.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming
            {upcomingItems.length > 0 && (
              <span className="ml-1 text-muted-foreground">{upcomingItems.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed
            {completedItems.length > 0 && (
              <span className="ml-1 text-muted-foreground">{completedItems.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="open-active">
            Open Active
            {openActiveItems.length > 0 && (
              <span className="ml-1 text-muted-foreground">{openActiveItems.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="open-upcoming">
            Open Upcoming
            {openUpcomingItems.length > 0 && (
              <span className="ml-1 text-muted-foreground">{openUpcomingItems.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          <ContributionGrid
            items={activeItems}
            emptyTitle="No active contributions"
            emptyDescription="You don't have any running contributions right now."
            emptyAction={{ label: "Browse available plans", onAction: () => switchTab("open-active") }}
          />
        </TabsContent>

        <TabsContent value="upcoming" className="mt-6">
          <ContributionGrid
            items={upcomingItems}
            emptyTitle="No upcoming contributions"
            emptyDescription="You don't have any contributions scheduled to start yet."
            emptyAction={{ label: "Browse available plans", onAction: () => switchTab("open-upcoming") }}
          />
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          <ContributionGrid
            items={completedItems}
            emptyTitle="No completed contributions"
            emptyDescription="You haven't completed any contributions yet."
          />
        </TabsContent>

        <TabsContent value="open-active" className="mt-6">
          {openActiveItems.length === 0 ? (
            <EmptyState
              title="No active plans to join"
              description="There are no running contribution plans open for joining right now."
            />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {openActiveItems.map((plan) => (
                  <AvailablePlanCard
                    key={plan.id}
                    plan={plan}
                    joining={joiningId === plan.id}
                    onJoin={() => handleJoin(plan.id)}
                  />
                ))}
              </div>
              <Pagination
                page={available.data?.page ?? 1}
                totalPages={available.data?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="open-upcoming" className="mt-6">
          {openUpcomingItems.length === 0 ? (
            <EmptyState
              title="No upcoming plans to join"
              description="There are no upcoming contribution plans open for joining right now."
            />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {openUpcomingItems.map((plan) => (
                  <AvailablePlanCard
                    key={plan.id}
                    plan={plan}
                    joining={joiningId === plan.id}
                    onJoin={() => handleJoin(plan.id)}
                  />
                ))}
              </div>
              <Pagination
                page={available.data?.page ?? 1}
                totalPages={available.data?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function AvailablePlanCard({
  plan,
  joining,
  onJoin,
}: {
  plan: Contribution
  joining: boolean
  onJoin: () => void
}) {
  return (
    <Card className="h-full transition-colors hover:border-primary/40">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-heading leading-snug font-medium">{plan.name}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatNaira(plan.amount)} / {plan.frequency}
            </p>
          </div>
          <Badge variant="outline">Open</Badge>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden="true" />
            {plan.memberCount} members
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Wallet className="size-3.5" aria-hidden="true" />
            {formatNaira(plan.totalContributed)} / {formatNaira(plan.totalExpected)}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Progress value={plan.progress} aria-label="Contribution progress" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{plan.progress}%</span>
            <span>Starts {formatDate(plan.startDate)}</span>
          </div>
        </div>

        <Button
          size="sm"
          className="mt-auto w-full"
          onClick={onJoin}
          disabled={joining}
        >
          <UserPlus />
          {joining ? "Joining…" : "Join"}
        </Button>
      </CardContent>
    </Card>
  )
}
