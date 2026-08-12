"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Brand } from "@/components/shared/brand"
import { cn } from "@/lib/utils"
import type { NavItem } from "@/components/navigation/config"

export function SidebarNavLink({ item }: { item: NavItem }) {
  const pathname = usePathname()
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`)

  const Icon = item.icon

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", active && "text-primary")}
        aria-hidden="true"
      />
      <span>{item.label}</span>
    </Link>
  )
}

function NavSection({
  label,
  items,
}: {
  label: string
  items: NavItem[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 text-xs font-medium text-muted-foreground">{label}</p>
      {items.map((item) => (
        <SidebarNavLink key={item.href} item={item} />
      ))}
    </div>
  )
}

export function DesktopSidebar({
  navGroups,
}: {
  navGroups: Array<{ label: string; items: NavItem[] }>
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-16 items-center border-b px-6">
        <Brand />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
        {navGroups.map((group) => (
          <NavSection key={group.label} {...group} />
        ))}
      </nav>
    </aside>
  )
}