"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, Wallet, CircleCheck, Circle, LogOut, UserPlus } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { ContributionProgress } from "@/components/contributions/contribution-progress"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CommissionBreakdown } from "@/components/shared/commission-breakdown"
import { EmergencyWithdrawalDialog } from "@/components/forms/emergency-withdrawal-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { FundContributionDialog } from "@/components/forms/fund-contribution-dialog"
import { useContribution, useJoinContribution, useLeaveContribution } from "@/hooks/queries/use-contributions"
import { useAuthStore } from "@/stores/auth-store"
import { formatDate, formatLongDate, formatMonthYear, formatNaira, getInitials } from "@/lib/format"
import { planHasStarted } from "@/lib/dates"
import { cn } from "@/lib/utils"

export default function ContributionDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { data: contribution, isPending, isError } = useContribution(id)
  const joinContribution = useJoinContribution()
  const leaveContribution = useLeaveContribution()
  const currentUserId = useAuthStore((state) => state.user?.id)
  const [fundOpen, setFundOpen] = React.useState(false)
  const [leaveOpen, setLeaveOpen] = React.useState(false)
  const [emergencyOpen, setEmergencyOpen] = React.useState(false)

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

  const myPayout = (contribution.payouts ?? []).find(
    (payout) => payout.memberId === currentMember?.id
  )
  const paidCount = contribution.schedule.filter((entry) => entry.status === "paid").length
  const withdrawPaid = myPayout?.status === "paid"
  const payoutEligible = myPayout?.status === "pending" && Boolean(myPayout.eligibleAt)
  const myWithdrawalDate = myPayout?.scheduledDate
  const withdrawSoon = myWithdrawalDate ? isUpcomingSoon(myWithdrawalDate) : false

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
          {!currentMember && contribution.isOpen && contribution.status !== "completed" && !planHasStarted(contribution.startDate) && (
            <Button
              onClick={() =>
                joinContribution.mutate(contribution.id, {
                  onSuccess: () => router.refresh(),
                })
              }
              disabled={joinContribution.isPending}
            >
              <UserPlus />
              {joinContribution.isPending ? "Joining…" : "Join"}
            </Button>
          )}
          {!currentMember && planHasStarted(contribution.startDate) && (
            <Badge variant="outline" className="border-transparent bg-warning/15 text-warning">
              Already started
            </Badge>
          )}
          {!withdrawalAvailable && contribution.status === "active" && currentMember && (
            <Button onClick={() => setFundOpen(true)}>
              <Wallet />
              Pay contribution
            </Button>
          )}
          {currentMember && (currentMember.totalContributed ?? 0) > 0 && (
            <Button variant="outline" size="sm" onClick={() => setEmergencyOpen(true)}>
              Request emergency withdrawal
            </Button>
          )}
          {currentMember && contribution.status !== "completed" && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setLeaveOpen(true)}
            >
              <LogOut />
              Leave
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
                <dd className="font-medium">
                  {contribution.endDate ? formatDate(contribution.endDate) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Next payment</dt>
                <dd className="font-medium">
                  {contribution.nextPaymentDate ? formatDate(contribution.nextPaymentDate) : "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Withdrawal</CardTitle>
            <CardDescription>
              {!currentMember
                ? "Join this plan to see your withdrawal position and date."
                : withdrawPaid
                  ? "Your payout has been paid into your wallet."
                  : payoutEligible
                    ? "Your round is complete and your payout is awaiting admin approval."
                    : `Due ${myWithdrawalDate ? formatLongDate(myWithdrawalDate) : "—"} — position ${currentMember.position} in the rotation`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "rounded-lg border p-4",
                !currentMember || !myWithdrawalDate
                  ? "bg-muted/40"
                  : withdrawPaid
                    ? "border-success/30 bg-success/10"
                    : payoutEligible
                      ? "border-info/30 bg-info/10"
                      : withdrawSoon
                        ? "border-warning/30 bg-warning/10"
                        : "bg-muted/40"
              )}
            >
              <p className={cn("text-sm font-medium", withdrawPaid ? "text-success" : payoutEligible && "text-info")}>
                {!currentMember
                  ? "You haven't joined this contribution yet."
                  : withdrawPaid
                    ? "Eligible — your payout is available in your wallet."
                    : payoutEligible
                      ? "Payout available — awaiting admin approval."
                      : `Your withdrawal opens on ${
                          myWithdrawalDate ? formatLongDate(myWithdrawalDate) : "—"
                        }`}
              </p>
              {payoutEligible && myPayout && (
                <div className="mt-3">
                  <CommissionBreakdown
                    gross={myPayout.grossAmount ?? myPayout.amount}
                    commission={myPayout.commissionAmount}
                    fee={undefined}
                    net={myPayout.netAmount}
                    netLabel="Net payout"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Contribution payouts require admin approval before they&apos;re credited
                    to your wallet.
                  </p>
                </div>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {contribution.withdrawalRule.note ??
                  "Withdrawal dates follow your rotation position. Payouts are credited to your wallet."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {currentMember && (
        <Card className="border-primary/30 bg-primary/[0.04]">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div className="flex items-center gap-4">
              <span
                className="flex size-12 items-center justify-center rounded-full bg-primary text-sm font-bold tabular-nums text-primary-foreground"
              >
                #{currentMember.position}
              </span>
              <div>
                <p className="font-heading font-medium">My contribution position</p>
                <p className="text-sm text-muted-foreground">
                  Position {currentMember.position} of {contribution.memberCount} ·{" "}
                  {paidCount} / {contribution.rounds} contributions paid
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <p className="text-sm text-muted-foreground">Expected withdrawal</p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold">
                  {myPayout ? formatMonthYear(myPayout.scheduledDate) : "—"}
                </p>
                {myPayout && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-transparent capitalize",
                      myPayout.status === "paid"
                        ? "bg-success/15 text-success"
                        : myPayout.status === "skipped"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {myPayout.status}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Leave this contribution?"
        description="You'll stop participating and your spot frees up. Your payment history is preserved."
        confirmLabel="Leave contribution"
        destructive
        loading={leaveContribution.isPending}
        onConfirm={() => {
          leaveContribution.mutate(contribution.id, {
            onSuccess: () => router.push("/contributions"),
          })
        }}
      />

      <EmergencyWithdrawalDialog
        open={emergencyOpen}
        onOpenChange={setEmergencyOpen}
        available={contribution.totalExpected}
        contributionId={contribution.id}
      />
    </div>
  )
}

function isUpcomingSoon(date: string) {
  const day = (new Date(date).getTime() - Date.now()) / 86_400_000
  return day >= 0 && day <= 14
}