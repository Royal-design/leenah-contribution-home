"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useContribution } from "@/hooks/queries/use-contributions"
import { formatDate, formatNaira, getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function AdminContributionDetailPage() {
  const params = useParams<{ id: string }>()
  const { data: contribution, isPending } = useContribution(params.id)

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!contribution) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
        <p className="text-sm font-medium">Contribution not found.</p>
        <Button variant="outline" size="sm" render={<Link href="/admin/contributions" />}>
          Back to contributions
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/admin/contributions" />}>
        <ChevronLeft />
        All contributions
      </Button>

      <PageHeader
        title={contribution.name}
        description={contribution.description}
      >
        <StatusBadge status={contribution.status} />
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Contribution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatNaira(contribution.amount)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                / {contribution.frequency}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{contribution.progress}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{contribution.memberCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Withdrawal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{formatDate(contribution.withdrawalDate)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>Member payment status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              {contribution.schedule.map((entry) => (
                <div
                  key={entry.period}
                  className="flex items-center justify-between gap-3 border-b py-3 text-sm last:border-0"
                >
                  <span className="font-medium">{entry.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">{formatNaira(entry.amount)}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        entry.status === "paid"
                          ? "bg-success/15 text-success"
                          : entry.status === "pending"
                            ? "bg-warning/15 text-warning"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {entry.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>People in this circle.</CardDescription>
          </CardHeader>
          <CardContent>
            {contribution.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar size="sm">
                    <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">Position {member.position}</p>
                  </div>
                </div>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatNaira(member.totalContributed)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}