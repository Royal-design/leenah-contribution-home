"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft, Wallet, CircleCheck, Circle } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { ContributionProgress } from "@/components/contributions/contribution-progress"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { FundContributionDialog } from "@/components/forms/fund-contribution-dialog"
import { useContribution } from "@/hooks/queries/use-contributions"
import { useAuthStore } from "@/stores/auth-store"
import { formatDate, formatLongDate, formatNaira, getInitials } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function ContributionDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { data: contribution, isPending, isError } = useContribution(id)
  const currentUserId = useAuthStore((state) => state.user?.id)
  const [fundOpen, setFundOpen] = React.useState(false)

  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-40 rounded-xl lg:col-span-2" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !contribution) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
        <p className="text-sm font-medium">Contribution not found.</p>
        <Button variant="outline" size="sm" render={<Link href="/contributions" />}>
          Back to contributions
        </Button>
      </div>
    )
  }

  const withdrawalAvailable =
    contribution.status === "completed" ||
    (contribution.withdrawalDate &&
      new Date(contribution.withdrawalDate) <= new Date())

  const currentMember = contribution.members.find(
    (member) => member.userId === currentUserId
  )

  return (
    <div className="flex flex-col gap-8">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/contributions" />}>
        <ChevronLeft />
        All contributions
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {contribution.name}
            </h1>
            <StatusBadge status={contribution.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{contribution.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {!withdrawalAvailable && contribution.status === "active" && (
            <Button onClick={() => setFundOpen(true)}>
              <Wallet />
              Pay contribution
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Contribution</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-3xl font-semibold tabular-nums">
              {formatNaira(contribution.amount)}{" "}
              <span className="text-base font-normal text-muted-foreground">
                / {contribution.frequency}
              </span>
            </p>
            <ContributionProgress
              current={contribution.totalContributed}
              total={contribution.totalExpected}
            />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Members</dt>
                <dd className="font-medium">{contribution.memberCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Your position</dt>
                <dd className="font-medium">{currentMember?.position ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Started</dt>
                <dd className="font-medium">{formatDate(contribution.startDate)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Ends</dt>
                <dd className="font-medium">{formatDate(contribution.endDate)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Next payment</dt>
                <dd className="font-medium">{formatDate(contribution.nextPaymentDate)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Withdrawal</CardTitle>
            <CardDescription>
              {withdrawalAvailable
                ? "Your share is available to withdraw now."
                : `Available from ${formatLongDate(contribution.withdrawalDate)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "rounded-lg border p-4",
                withdrawalAvailable
                  ? "border-success/30 bg-success/10"
                  : isUpcomingSoon(contribution.withdrawalDate)
                    ? "border-warning/30 bg-warning/10"
                    : "bg-muted/40"
              )}
            >
              <p
                className={cn(
                  "text-sm font-medium",
                  withdrawalAvailable && "text-success"
                )}
              >
                {withdrawalAvailable
                  ? "Eligible — withdrawal is currently available."
                  : `Withdrawal available on ${formatLongDate(contribution.withdrawalDate)}`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {contribution.withdrawalRule.note ??
                  "Payouts are sent to your registered bank account."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contribution schedule</CardTitle>
            <CardDescription>Your payment status across the cycle.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              {contribution.schedule.length === 0 && (
                <p className="py-4 text-sm text-muted-foreground">
                  The schedule will populate once the cycle begins.
                </p>
              )}
              {contribution.schedule.map((entry) => {
                const isPaid = entry.status === "paid"
                const isPending = entry.status === "pending"
                return (
                  <div
                    key={entry.period}
                    className="flex items-center justify-between gap-3 border-b py-3 text-sm last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center",
                          isPaid
                            ? "text-success"
                            : isPending
                              ? "text-warning"
                              : "text-muted-foreground"
                        )}
                      >
                        {isPaid ? (
                          <CircleCheck className="size-5" aria-hidden="true" />
                        ) : (
                          <Circle className="size-5" aria-hidden="true" />
                        )}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-medium">{entry.label}</span>
                        <span className="text-xs text-muted-foreground">
                          Due {formatDate(entry.dueDate)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums">{formatNaira(entry.amount)}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          isPaid
                            ? "bg-success/15 text-success"
                            : isPending
                              ? "bg-warning/15 text-warning"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {entry.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>{contribution.memberCount} people in this circle.</CardDescription>
          </CardHeader>
          <CardContent>
            {contribution.members.map((member) => {
              const isCurrent = member.userId === currentUserId
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {member.name}
                        {isCurrent && (
                          <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">Position {member.position}</p>
                    </div>
                  </div>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatNaira(member.totalContributed)}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <FundContributionDialog
        open={fundOpen}
        onOpenChange={setFundOpen}
        contribution={contribution}
      />
    </div>
  )
}

function isUpcomingSoon(date: string) {
  const day = (new Date(date).getTime() - Date.now()) / 86_400_000
  return day >= 0 && day <= 14
}