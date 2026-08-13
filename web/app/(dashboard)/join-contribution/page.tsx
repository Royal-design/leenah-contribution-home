"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/shared/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { formatDate, formatNaira } from "@/lib/format"
import { useOpenContributions, useJoinContribution } from "@/hooks/queries/use-contributions"
import { cn } from "@/lib/utils"
import type { Contribution } from "@/types"

export default function JoinContributionPage() {
  const router = useRouter()
  const joinContribution = useJoinContribution()
  const openContributions = useOpenContributions({ page: 1, pageSize: 50 })

  const plans = openContributions.data?.items ?? []
  const [planId, setPlanId] = React.useState<string>("")

  const selectedPlan = plans.find((plan) => plan.id === planId) ?? null

  function onJoin() {
    if (!planId) return
    joinContribution.mutate(planId, {
      onSuccess: () => router.push("/contributions"),
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.back()}>
        <ChevronLeft />
        Back
      </Button>

      <PageHeader
        title="Join a contribution"
        description="Pick an open plan and claim your spot. Money is only deducted when you fund a contribution."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Available plans</CardTitle>
              <CardDescription>Plans created by LCH — tap one to review and join.</CardDescription>
            </CardHeader>
            <CardContent>
              {openContributions.isPending ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }, (_, index) => (
                    <Skeleton key={index} className="h-24 w-full rounded-lg" />
                  ))}
                </div>
              ) : plans.length === 0 ? (
                <EmptyState
                  title="No open plans"
                  description="There are no open contribution plans right now. Check back soon."
                />
              ) : (
                <div className="grid gap-2">
                  {plans.map((plan) => {
                    const active = plan.id === planId
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setPlanId(plan.id)}
                        aria-pressed={active}
                        className={cn(
                          "flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors",
                          active
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "hover:border-border hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{plan.name}</span>
                          <Badge variant="outline">{plan.frequency}</Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatNaira(plan.amount)} / {plan.frequency} · {plan.memberCount} members ·{" "}
                          {plan.rounds} rounds
                        </span>
                        <span className="mt-1 text-sm text-muted-foreground">
                          Starts {formatDate(plan.startDate)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            size="lg"
            disabled={!planId || joinContribution.isPending}
            onClick={onJoin}
          >
            {joinContribution.isPending ? "Joining…" : "Join plan"}
          </Button>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ContributionSummary plan={selectedPlan} />
        </aside>
      </div>
    </div>
  )
}

function ContributionSummary({ plan }: { plan: Contribution | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          Plan summary
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {!plan ? (
          <p className="text-muted-foreground">Select a plan to see its details.</p>
        ) : (
          <>
            <div>
              <p className="text-muted-foreground">Plan</p>
              <p className="font-medium">{plan.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Contribution</p>
              <p className="font-medium tabular-nums">
                {formatNaira(plan.amount)} / {plan.frequency}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total you&apos;ll contribute</p>
              <p className="font-medium tabular-nums">{formatNaira(plan.amount * plan.rounds)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Starts</p>
              <p className="font-medium">{formatDate(plan.startDate)}</p>
            </div>
            {plan.withdrawalDate && (
              <div>
                <p className="text-muted-foreground">Withdrawal from</p>
                <p className="font-medium">{formatDate(plan.withdrawalDate)}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Members</p>
              <p className="font-medium">{plan.memberCount}</p>
            </div>
            <Separator className="my-1" />
            <p className="text-xs text-muted-foreground">
              Joining does not deduct any money. You&apos;ll fund each contribution from your wallet.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
