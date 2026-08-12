"use client"

import Link from "next/link"
import { Plus, PiggyBank, Users, ArrowLeftRight } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

export type QuickAction = {
  label: string
  icon: typeof Plus
  href?: string
  onClick?: () => void
}

export function QuickActions({
  actions,
}: {
  actions: QuickAction[]
}) {
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const Icon = action.icon
          const style = (
            <span className="flex flex-col items-center gap-2 rounded-lg border border-transparent px-3 py-4 text-sm font-medium transition-colors hover:border-border hover:bg-muted/50">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              {action.label}
            </span>
          )
          return action.href ? (
            <Link key={action.label} href={action.href} className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-lg">
              {style}
            </Link>
          ) : (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-lg"
            >
              {style}
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}