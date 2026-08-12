import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatNaira } from "@/lib/format"

type AmountDisplayTone = "default" | "success" | "destructive"

export function AmountDisplay({
  amount,
  direction = "default",
  className,
}: {
  amount: number
  direction?: "default" | "incoming" | "outgoing"
  className?: string
}) {
  const tone: AmountDisplayTone =
    direction === "incoming"
      ? "success"
      : direction === "outgoing"
        ? "destructive"
        : "default"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 tabular-nums",
        tone === "default" && "text-foreground",
        tone === "success" && "text-success",
        tone === "destructive" && "text-destructive",
        className
      )}
    >
      {direction === "incoming" && (
        <ArrowDownRight className="size-3.5" aria-hidden="true" />
      )}
      {direction === "outgoing" && (
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      )}
      {formatNaira(amount)}
    </span>
  )
}