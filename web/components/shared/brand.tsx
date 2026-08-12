import Link from "next/link"
import { HandCoins } from "lucide-react"

import { cn } from "@/lib/utils"

export function Brand({
  className,
  href = "/dashboard",
}: {
  className?: string
  href?: string
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <HandCoins className="size-4" aria-hidden="true" />
      </span>
      <span className="text-base font-semibold tracking-tight">LCH</span>
    </Link>
  )
}