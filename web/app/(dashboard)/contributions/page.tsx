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

type ContributionsTab = "joined" | "available"

export default function ContributionsPage() {
  const router = useRouter()
  const currentUserId = useAuthStore((state) => state.user?.id)
  const [tab, setTab] = React.useState<ContributionsTab>("joined")
  const [page, setPage] = React.useState(1)

  const joined = useContributions({ page, pageSize: PAGE_SIZE })
  const available = useOpenContributions({ page, pageSize: PAGE_SIZE })
  const joinContribution = useJoinContribution()

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

  const groups: Array<{ label: string; items: Contribution[] }> = [
    { label: "Active", items: joinedItems.filter((c) => c.status === "active") },
    { label: "Upcoming", items: joinedItems.filter((c) => c.status === "upcoming") },
    { label: "Completed", items: joinedItems.filter((c) => c.status === "completed") },
  ]

  function handleJoin(planId: string) {
    joinContribution.mutate(planId, {
      onSuccess: () => router.push(`/contributions/${planId}`),
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Contributions"
        description="Join contribution circles and track your progress."
      >
        <Button
          size="sm"
          onClick={() => {
            setTab("available")
            setPage(1)
          }}
        >
          <Plus />
          Join a contribution
        </Button>
      </PageHeader>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setPage(1)
          setTab((value as ContributionsTab) ?? "joined")
        }}
      >
        <TabsList>
          <TabsTrigger value="joined">
            Joined
            {joinedItems.length > 0 && (
              <span className="ml-1 text-muted-foreground">{joinedItems.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="available">
            Available
            {availableItems.length > 0 && (
              <span className="ml-1 text-muted-foreground">{availableItems.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="joined" className="mt-6 flex flex-col gap-8">
          {joinedItems.length === 0 && (
            <EmptyState
              title="You haven't joined any contributions yet"
              description="Open the Available tab to find plans you can join."
              action={{
                label: "Browse available plans",
                onAction: () => {
                  setTab("available")
                  setPage(1)
                },
              }}
            />
          )}

          {groups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h2 className="font-heading text-lg font-medium tracking-tight">
                  {group.label}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {group.items.length}
                  </span>
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((contribution) => (
                    <ContributionCard
                      key={contribution.id}
                      contribution={contribution}
                    />
                  ))}
                </div>
              </section>
            ))}

          {joinedItems.length > 0 && (
            <Pagination
              page={joined.data?.page ?? 1}
              totalPages={joined.data?.totalPages ?? 1}
              onPageChange={setPage}
            />
          )}
        </TabsContent>

        <TabsContent value="available" className="mt-6 flex flex-col gap-6">
          {availableItems.length === 0 ? (
            <EmptyState
              title="No available plans"
              description="There are no open contribution plans right now. Check back soon."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {availableItems.map((plan) => (
                <AvailablePlanCard
                  key={plan.id}
                  plan={plan}
                  joining={joinContribution.isPending}
                  onJoin={() => handleJoin(plan.id)}
                />
              ))}
            </div>
          )}

          {availableItems.length > 0 && (
            <Pagination
              page={available.data?.page ?? 1}
              totalPages={available.data?.totalPages ?? 1}
              onPageChange={setPage}
            />
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