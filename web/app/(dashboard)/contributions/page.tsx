"use client"

import { Plus } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { ContributionCard } from "@/components/contributions/contribution-card"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/skeletons"
import { Button } from "@/components/ui/button"
import { Pagination } from "@/components/ui/pagination"
import { useContributions } from "@/hooks/queries/use-contributions"
import type { Contribution } from "@/types"

const PAGE_SIZE = 9

export default function ContributionsPage() {
  const [page, setPage] = React.useState(1)
  const { data, isPending, isError, refetch } = useContributions({
    page,
    pageSize: PAGE_SIZE,
  })

  if (isPending) {
    return <PageSkeleton />
  }

  const items = data?.items ?? []

  const groups: Array<{ label: string; items: Contribution[] }> = [
    { label: "Active", items: items.filter((c) => c.status === "active") },
    { label: "Upcoming", items: items.filter((c) => c.status === "upcoming") },
    {
      label: "Completed",
      items: items.filter((c) => c.status === "completed"),
    },
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
          <p className="text-sm text-destructive">
            Could not load contributions.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {items.length === 0 && !isError && (
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

      <Pagination
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        onPageChange={setPage}
      />
    </div>
  )
}
