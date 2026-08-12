"use client"

import Link from "next/link"
import { Plus, PiggyBank, Users, ArrowLeftRight } from "lucide-react"

export type QuickAction = {
  label: string
  icon: typeof Plus
  href?: string
  onClick?: () => void
  description?: string
}

export function QuickActions({
  actions,
}: {
  actions: QuickAction[]
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon
        const content = (
          <div className="flex flex-col items-start gap-3 rounded-xl bg-card p-4 shadow-sm shadow-black/[0.06] transition-colors dark:shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{action.label}</p>
              {action.description && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {action.description}
                </p>
              )}
            </div>
          </div>
        )
        return action.href ? (
          <Link
            key={action.label}
            href={action.href}
            className="min-w-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-xl"
          >
            {content}
          </Link>
        ) : (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="min-w-0 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-xl"
          >
            {content}
          </button>
        )
      })}
    </div>
  )
}