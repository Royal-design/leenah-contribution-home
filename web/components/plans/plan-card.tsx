"use client"

import Link from "next/link"
import { CalendarClock, PiggyBank, Users, Wallet } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { formatDate, formatMonthYear, formatNaira } from "@/lib/format"
import { formatDurationMonths } from "@/lib/dates"
import { useAuthStore } from "@/stores/auth-store"
import type { Contribution, SavingsPlan } from "@/types"

export type PlanType = "savings" | "contribution"

interface PlanCardProps {
  type: PlanType
  plan: SavingsPlan | Contribution
  href: string
  joined?: boolean
}

export function PlanCard({ type, plan, href, joined = false }: PlanCardProps) {
  const currentUserId = useAuthStore((state) => state.user?.id)
  const isSavings = type === "savings"
  const sp = isSavings ? (plan as SavingsPlan) : null
  const con = isSavings ? null : (plan as Contribution)

  const progress = isSavings ? (sp?.progress ?? 0) : (con?.progress ?? 0)
  const enrolled = isSavings ? (sp?.enrollCount ?? 0) : (con?.memberCount ?? 0)
  const startDate = isSavings ? (sp?.startDate ?? "") : (con?.startDate ?? "")
  const endDate = isSavings ? (sp?.endDate ?? "") : (con?.endDate ?? "")
  const frequency = isSavings ? (sp?.frequency ?? "monthly") : (con?.frequency ?? "monthly")
  const totalSaved = isSavings ? (sp?.totalSaved ?? 0) : (con?.totalContributed ?? 0)
  const durationLabel = isSavings
    ? formatDurationMonths(sp?.durationMonths)
    : con
      ? `${con.rounds} ${con.rounds === 1 ? "round" : "rounds"}`
      : ""

  const myMember = !isSavings
    ? con?.members.find((member) => member.userId === currentUserId)
    : undefined
  const myPayout = !isSavings
    ? (con?.payouts ?? []).find((payout) => payout.memberId === myMember?.id)
    : undefined

  return (
    <Link href={href} className="group block outline-none">
      <Card className="flex h-full flex-col transition-colors group-hover:border-primary/40 group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
        <CardContent className="flex flex-1 flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-transparent bg-primary/10 text-primary dark:bg-primary/20"
                >
                  {isSavings ? "Savings" : "Contribution"}
                </Badge>
                {joined && (
                  <Badge variant="outline" className="border-transparent bg-success/15 text-success">
                    Joined
                  </Badge>
                )}
              </div>
              <h3 className="mt-2 font-heading leading-snug font-medium">{plan.name}</h3>
              {plan.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {plan.description}
                </p>
              )}
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <p className="text-lg font-semibold tabular-nums">
              {formatNaira(plan.amount)}{" "}
              <span className="text-sm font-normal text-muted-foreground">/ {frequency}</span>
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" aria-hidden="true" />
                <span>
                  {startDate ? formatDate(startDate) : "—"}
                  {endDate ? ` → ${formatDate(endDate)}` : ""}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                {isSavings ? (
                  <PiggyBank className="size-3.5" aria-hidden="true" />
                ) : (
                  <Users className="size-3.5" aria-hidden="true" />
                )}
                <span>{durationLabel}</span>
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Progress value={progress} aria-label="Plan progress" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {joined ? (
                    isSavings ? (
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="size-3.5" aria-hidden="true" />
                        {formatNaira(totalSaved)} saved
                      </span>
                    ) : myMember ? (
                      <span>
                        Position #{myMember.position}
                        {myPayout ? ` · Withdrawal ${formatMonthYear(myPayout.scheduledDate)}` : ""}
                      </span>
                    ) : (
                      <span>{formatNaira(totalSaved)} contributed</span>
                    )
                  ) : (
                    <span>{progress}% funded</span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1">
                  {enrolled} {isSavings ? (enrolled === 1 ? "member" : "members") : "seats"}
                </span>
              </div>
            </div>

            <span className="inline-flex w-fit items-center text-sm font-medium text-primary">
              {joined ? "View my progress" : "View plan"}
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}