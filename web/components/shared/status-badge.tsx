import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Status = "active" | "upcoming" | "completed" | "paused" | "draft"

const variantByStatus: Record<Status, string> = {
  active: "border-transparent bg-success/15 text-success dark:bg-success/20",
  upcoming: "border-transparent bg-info/15 text-info dark:bg-info/25",
  completed: "border-transparent bg-muted text-muted-foreground",
  paused: "border-transparent bg-warning/15 text-warning dark:bg-warning/20",
  draft: "border-transparent bg-muted text-muted-foreground",
}

export function StatusBadge({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const normalized = status.toLowerCase() as Status
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium capitalize",
        variantByStatus[normalized] ?? variantByStatus.completed,
        className
      )}
    >
      {status}
    </Badge>
  )
}