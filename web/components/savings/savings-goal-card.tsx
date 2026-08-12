import Link from "next/link"
import { CircleCheck, PiggyBank } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SavingsGoalProgress } from "@/components/contributions/contribution-progress"
import type { SavingsGoal } from "@/types"

export function SavingsGoalCard({
  goal,
  href,
}: {
  goal: SavingsGoal
  href?: string
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PiggyBank className="size-4" aria-hidden="true" />
          </span>
          <h3 className="font-heading leading-snug font-medium">{goal.name}</h3>
        </div>
        {goal.status === "completed" && (
          <Badge variant="outline" className="gap-1 border-transparent bg-success/15 text-success">
            <CircleCheck className="size-3" aria-hidden="true" />
            Completed
          </Badge>
        )}
      </div>
      <SavingsGoalProgress current={goal.current} target={goal.target} />
    </>
  )

  return (
    <Card className="h-full transition-colors hover:border-primary/40">
      <CardContent className="flex flex-col gap-5">
        {href ? (
          <Link href={href} className="flex flex-col gap-5 outline-none">
            {content}
          </Link>
        ) : (
          content
        )}
      </CardContent>
    </Card>
  )
}