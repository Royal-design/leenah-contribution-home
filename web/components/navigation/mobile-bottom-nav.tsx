"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { mobilePrimaryNav } from "@/components/navigation/config"
import { Button } from "@/components/ui/button"

export function MobileBottomNav({
  onCenterAction,
}: {
  onCenterAction: () => void
}) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-1 rounded-2xl border bg-popover/95 px-2 py-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-popover/85 z-[1] m-0!" style={{ width: "calc(100% - 2rem)" }}>
        <div className="flex flex-1 items-center justify-around">
          {mobilePrimaryNav.slice(0, 2).map((item) => {
            const Icon = item.icon
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[0.7rem] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}

          <button
            type="button"
            onClick={onCenterAction}
            aria-label="Add money"
            className="mx-1 flex -translate-y-1 flex-col items-center"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-background transition-transform active:scale-95">
              <Plus className="size-5" aria-hidden="true" />
            </span>
            <span className="mt-0.5 text-[0.7rem] font-medium text-primary">
              Add Money
            </span>
          </button>

          {mobilePrimaryNav.slice(2).map((item) => {
            const Icon = item.icon
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[0.7rem] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
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
  return <Button variant="ghost" size="icon" aria-hidden="true" className="hidden" />
}