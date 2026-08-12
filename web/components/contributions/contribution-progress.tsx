import { Progress } from "@/components/ui/progress"
import { formatNaira } from "@/lib/format"

export function ContributionProgress({
  current,
  total,
  className,
}: {
  current: number
  total: number
  className?: string
}) {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-medium tabular-nums">{formatNaira(current)}</span>
        <span className="text-muted-foreground">of {formatNaira(total)}</span>
      </div>
      <Progress value={percent} aria-label="Contribution progress" />
    </div>
  )
}

export function SavingsGoalProgress({
  current,
  target,
  className,
}: {
  current: number
  target: number
  className?: string
}) {
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-medium tabular-nums">
          {formatNaira(current)} of {formatNaira(target)}
        </span>
        <span className="text-muted-foreground">{percent}%</span>
      </div>
      <Progress value={percent} aria-label="Goal progress" />
    </div>
  )
}