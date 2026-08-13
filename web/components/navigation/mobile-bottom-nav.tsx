"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  adminMobilePrimaryNav,
  mobilePrimaryNav,
} from "@/components/navigation/config"

export function MobileBottomNav({
  isAdmin = false,
  onCenterAction,
}: {
  isAdmin?: boolean
  onCenterAction: () => void
}) {
  const pathname = usePathname()

  const navItems =
    isAdmin ? adminMobilePrimaryNav : mobilePrimaryNav

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    >
      <div className="relative mx-auto max-w-md rounded-2xl border bg-popover/95 px-3 pt-3 pb-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur supports-[backdrop-filter]:bg-popover/85">
        <div className="grid grid-cols-5 items-end">
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[0.68rem] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary/10"
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            )
          })}

          <button
            type="button"
            onClick={onCenterAction}
            aria-label="Add money"
            className="relative flex min-h-14 flex-col items-center justify-center"
          >
            <span className="absolute -top-6 flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95">
              <Plus className="size-6" aria-hidden="true" />
            </span>
          </button>

          {navItems.slice(2).map((item) => {
            const Icon = item.icon
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[0.68rem] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary/10"
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

export function MobileNavFallback() {
  return null
}