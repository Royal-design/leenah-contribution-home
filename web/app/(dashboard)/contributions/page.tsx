"use client"

import Link from "next/link"
import { Plus } from "lucide-react"

import { ContributionCard } from "@/components/contributions/contribution-card"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { PageSkeleton } from "@/components/shared/skeletons"
import { useContributions } from "@/hooks/queries/use-contributions"
import type { Contribution } from "@/types"

export default function ContributionsPage() {
  const { data, isPending, isError, refetch } = useContributions()

  if (isPending) {
    return <PageSkeleton />
  }

  const groups: Array<{ label: string; items: Contribution[] }> = [
    { label: "Active", items: (data ?? []).filter((c) => c.status === "active") },
    { label: "Upcoming", items: (data ?? []).filter((c) => c.status === "upcoming") },
    { label: "Completed", items: (data ?? []).filter((c) => c.status === "completed") },
  ]

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Contributions"
        description="Join contribution circles and track your progress."
      >
        <Button size="sm" render={<Link href="/join-contribution" />}>
          <Plus />
          Join a contribution
        </Button>
      </PageHeader>

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-12 text-center">
          <p className="text-sm text-destructive">Could not load contributions.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data?.length === 0 && (
        <EmptyState
          title="No contributions yet"
          description="Join a contribution circle to start building with others."
          action={{
            label: "Join a contribution",
            onAction: () => undefined,
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
    </div>
  )
}