import Link from "next/link"
import { Users, Wallet } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import { formatDate, formatNaira } from "@/lib/format"
import { Progress } from "@/components/ui/progress"
import type { Contribution } from "@/types"

export function ContributionCard({
  contribution,
}: {
  contribution: Contribution
}) {
  return (
    <Link
      href={`/contributions/${contribution.id}`}
      className="group block outline-none"
    >
      <Card className="h-full transition-colors group-hover:border-primary/40 group-focus-visible:ring-3 group-focus-visible:ring-ring/50">
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-heading leading-snug font-medium">
                {contribution.name}
              </h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatNaira(contribution.amount)} / {contribution.frequency}
              </p>
            </div>
            <StatusBadge status={contribution.status} />
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden="true" />
              {contribution.memberCount} members
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="size-3.5" aria-hidden="true" />
              {formatNaira(contribution.totalContributed)} /{" "}
              {formatNaira(contribution.totalExpected)}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Progress
              value={contribution.progress}
              aria-label="Contribution progress"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{contribution.progress}% complete</span>
              <span>Next: {formatDate(contribution.nextPaymentDate)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}