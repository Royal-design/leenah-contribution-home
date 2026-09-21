"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, Circle, CircleCheck, LogOut, UserPlus, Wallet } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  useSavingsPlan,
  useJoinSavingsPlan,
  useLeaveSavingsPlan,
  usePaySavingsPlan,
} from "@/hooks/queries/use-savings-plans"
import { formatDate, formatNaira } from "@/lib/format"
import { formatDurationMonths, planHasStarted } from "@/lib/dates"
import { cn } from "@/lib/utils"

export default function SavingsPlanDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const { data: plan, isPending, isError } = useSavingsPlan(id)
  const joinPlan = useJoinSavingsPlan()
  const leavePlan = useLeaveSavingsPlan()
  const payPlan = usePaySavingsPlan()
  const [leaveOpen, setLeaveOpen] = React.useState(false)

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

  if (isError || !plan) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center">
        <p className="text-sm font-medium">Savings plan not found.</p>
        <Button variant="outline" size="sm" render={<Link href="/plans" />}>
          Back to plans
        </Button>
      </div>
    )
  }

  const joined = Boolean(plan.enrollment)
  const schedule = plan.schedule ?? []
  const nextDue = schedule.find((entry) => entry.status !== "paid")
  const totalExpectedForMe = plan.amount * plan.rounds

  function handleJoin() {
    joinPlan.mutate(id, {
      onSuccess: () => router.refresh(),
    })
  }

  function handlePay() {
    if (!nextDue) return
    payPlan.mutate({ id, scheduleId: nextDue.id })
  }

  return (
    <div className="flex flex-col gap-8">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/plans" />}>
        <ChevronLeft />
        Explore plans
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="border-transparent bg-primary/10 text-primary">
              Savings plan
            </Badge>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{plan.name}</h1>
            <StatusBadge status={plan.status} />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{plan.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {!joined ? (
            plan.isOpen && plan.status !== "completed" && !planHasStarted(plan.startDate) ? (
              <Button onClick={handleJoin} disabled={joinPlan.isPending}>
                <UserPlus />
                {joinPlan.isPending ? "Joining…" : "Join plan"}
              </Button>
            ) : (
              <Badge variant="outline">
                {planHasStarted(plan.startDate) ? "Already started" : "Not open for joining"}
              </Badge>
            )
          ) : (
            <>
              {nextDue && plan.status !== "completed" && (
                <Button onClick={handlePay} disabled={payPlan.isPending}>
                  <Wallet />
                  {payPlan.isPending ? "Paying…" : `Pay ${formatNaira(nextDue.amount)}`}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setLeaveOpen(true)}
              >
                <LogOut />
                Leave
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Your savings plan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-semibold tabular-nums">
                  {formatNaira(plan.amount)}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    / {plan.frequency}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {joined
                    ? `${formatNaira(plan.enrollment?.totalSaved ?? 0)} saved of ${formatNaira(totalExpectedForMe)} expected`
                    : `You'll save ${formatNaira(totalExpectedForMe)} over ${plan.rounds} ${plan.rounds === 1 ? "payment" : "payments"}`}
                </p>
              </div>
              <p className="text-2xl font-semibold tabular-nums text-primary">{plan.progress}%</p>
            </div>
            <Progress value={plan.progress} aria-label="Savings plan progress" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Plan details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{formatDurationMonths(plan.durationMonths)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Starts</span>
              <span className="font-medium">{formatDate(plan.startDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Ends</span>
              <span className="font-medium">{plan.endDate ? formatDate(plan.endDate) : "—"}</span>
            </div>
            {plan.targetAmount ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Funding target</span>
                <span className="font-medium tabular-nums">{formatNaira(plan.targetAmount)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Members</span>
              <span className="font-medium">{plan.enrollCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Next payment</span>
              <span className="font-medium">
                {nextDue ? formatDate(nextDue.dueDate) : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your payment schedule</CardTitle>
          <CardDescription>
            {joined
              ? "Payments are taken from your wallet on each due date."
              : "Join this plan to see your payment schedule. No money is deducted until you pay a scheduled amount."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schedule.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              {joined
                ? "Your schedule is still being prepared."
                : "Your schedule will appear here once you join."}
            </p>
          ) : (
            <div className="flex flex-col">
              {schedule.map((entry) => {
                const isPaid = entry.status === "paid"
                const isPending = entry.status === "pending"
                return (
                  <div
                    key={entry.id}
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
                        <span className="font-medium">{entry.label ?? `Payment ${entry.period}`}</span>
                        <span className="text-xs text-muted-foreground">
                          Due {formatDate(entry.dueDate)}
                        </span>
                      </div>
                    </div>
                    <span className="tabular-nums">{formatNaira(entry.amount)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Leave this savings plan?"
        description="You'll stop participating in this plan. Your payment history is preserved."
        confirmLabel="Leave plan"
        destructive
        loading={leavePlan.isPending}
        onConfirm={() => {
          leavePlan.mutate(id, {
            onSuccess: () => router.push("/my-plans"),
          })
        }}
      />
    </div>
  )
}