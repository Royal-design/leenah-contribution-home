"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { mobilePrimaryNav } from "@/components/navigation/config"

export function MobileBottomNav({
  onCenterAction,
}: {
  onCenterAction: () => void
}) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-popover/95 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)] backdrop-blur supports-[backdrop-filter]:bg-popover/85"
    >
      <div className="relative mx-auto grid max-w-lg grid-cols-5 items-center px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)]">
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
                "flex flex-col items-center gap-0.5 rounded-lg py-2 text-[0.7rem] font-medium transition-colors",
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
          className="flex flex-col items-center gap-0.5 pt-2 text-[0.7rem] font-medium text-primary"
        >
          <span className="flex size-12 -translate-y-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95">
            <Plus className="size-5" aria-hidden="true" />
          </span>
          <span className="-mt-5 whitespace-nowrap">Add Money</span>
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
                "flex flex-col items-center gap-0.5 rounded-lg py-2 text-[0.7rem] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function MobileNavFallback() {
  return null
}