import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function DashboardStatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "default",
  className,
}: {
  title: string
  value: string
  description?: string
  icon: LucideIcon
  tone?: "default" | "success" | "warning" | "info"
  className?: string
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    info: "bg-info/15 text-info",
  }

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </div>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            toneClasses[tone]
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </CardHeader>
      <CardContent className="mt-1">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        {description && (
          <CardDescription className="mt-1">{description}</CardDescription>
        )}
      </CardContent>
    </Card>
  )
}