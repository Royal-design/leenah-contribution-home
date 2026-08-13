"use client"

import {
  Grid,
  LayoutDashboard,
  LogOut,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"

import {
  adminMobilePrimaryNav,
  adminNavGroups,
  mobilePrimaryNav,
  userNavGroups,
  type NavItem,
} from "@/components/navigation/config"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { getInitials } from "@/lib/format"
import { isAdmin as hasAdminAccess } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"
import { useUiStore } from "@/stores/ui-store"

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function DockLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
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
}

function SheetLink({
  item,
  onNavigate,
}: {
  item: NavItem
  onNavigate: () => void
}) {
  const pathname = usePathname()
  const Icon = item.icon
  const active = isActivePath(pathname, item.href)
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="truncate">{item.label}</span>
      {active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
    </Link>
  )
}

function SheetGroup({
  label,
  items,
  onNavigate,
}: {
  label: string
  items: NavItem[]
  onNavigate: () => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 text-xs font-medium text-muted-foreground">{label}</p>
      {items.map((item) => (
        <SheetLink key={item.href} item={item} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

function MobileNavSheet({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const open = useUiStore((state) => state.mobileNavOpen)
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  const close = React.useCallback(
    () => setMobileNavOpen(false),
    [setMobileNavOpen]
  )

  React.useEffect(() => {
    close()
  }, [pathname, close])

  const groups = isAdmin ? adminNavGroups : userNavGroups

  async function handleLogout() {
    close()
    await logout()
    router.push("/login")
  }

  return (
    <Sheet open={open} onOpenChange={setMobileNavOpen}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[min(82svh,40rem)] px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <SheetDescription className="sr-only">
          All sections and account actions.
        </SheetDescription>

        <div className="mx-auto h-1.5 w-12 shrink-0 rounded-full bg-muted" />

        <div className="flex shrink-0 items-center justify-between px-1 pt-3">
          <p className="font-heading text-base font-medium">Menu</p>
          <button
            type="button"
            onClick={close}
            aria-label="Close navigation"
            className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto px-1 pt-4">
          {user && (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
              <Avatar>
                <AvatarFallback>
                  {getInitials(user.firstName, user.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
          )}

          {hasAdminAccess(user) && (
            <button
              type="button"
              onClick={() => {
                close()
                router.push(isAdmin ? "/dashboard" : "/admin/dashboard")
              }}
              className="flex items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {isAdmin ? (
                <>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <LayoutDashboard className="size-4" aria-hidden="true" />
                  </span>
                  Switch to user dashboard
                </>
              ) : (
                <>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <ShieldCheck className="size-4" aria-hidden="true" />
                  </span>
                  Switch to admin dashboard
                </>
              )}
            </button>
          )}

          {groups.map((group) => (
            <SheetGroup
              key={group.label}
              label={group.label}
              items={group.items}
              onNavigate={close}
            />
          ))}

          {user && (
            <div className="border-t pt-4">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <LogOut className="size-4" aria-hidden="true" />
                </span>
                Sign out
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function MobileBottomNav({
  isAdmin = false,
  onCenterAction,
}: {
  isAdmin?: boolean
  onCenterAction: () => void
}) {
  const pathname = usePathname()
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen)
  const mobileNavOpen = useUiStore((state) => state.mobileNavOpen)

  const navItems = isAdmin ? adminMobilePrimaryNav : mobilePrimaryNav

  const [leftItem, secondItem, thirdItem, fourthItem] = navItems

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <div className="relative mx-auto max-w-md rounded-2xl border bg-popover/95 px-3 pt-3 pb-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur supports-[backdrop-filter]:bg-popover/85">
          <div className="grid grid-cols-5 items-end">
            {leftItem && (
              <DockLink
                item={leftItem}
                active={isActivePath(pathname, leftItem.href)}
              />
            )}
            {secondItem && (
              <DockLink
                item={secondItem}
                active={isActivePath(pathname, secondItem.href)}
              />
            )}

            {isAdmin ? (
              thirdItem && (
                <Link
                  href={thirdItem.href}
                  aria-label={thirdItem.label}
                  aria-current={isActivePath(pathname, thirdItem.href) ? "page" : undefined}
                  className="relative flex min-h-14 flex-col items-center justify-center"
                >
                  <span
                    className={cn(
                      "absolute -top-6 flex size-13 items-center justify-center rounded-full shadow-lg ring-4 ring-background transition-transform active:scale-95",
                      isActivePath(pathname, thirdItem.href)
                        ? "bg-primary text-primary-foreground shadow-primary/30"
                        : "bg-popover text-primary ring-border shadow-none"
                    )}
                  >
                    <thirdItem.icon className="size-6" aria-hidden="true" />
                  </span>
                  <span className="mt-7 text-[0.68rem] font-medium text-muted-foreground">
                    {thirdItem.label}
                  </span>
                </Link>
              )
            ) : (
              <button
                type="button"
                onClick={onCenterAction}
                aria-label="Add money"
                className="relative flex min-h-14 flex-col items-center justify-center"
              >
                <span className="absolute -top-6 flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 shadow-primary/30 ring-background transition-transform active:scale-95">
                  <Plus className="size-6" aria-hidden="true" />
                </span>
              </button>
            )}

            <DockLink
              item={isAdmin ? fourthItem : thirdItem}
              active={isActivePath(
                pathname,
                (isAdmin ? fourthItem : thirdItem).href
              )}
            />

            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[0.68rem] font-medium transition-colors",
                mobileNavOpen ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                  mobileNavOpen && "bg-primary/10"
                )}
              >
                <Grid className="size-5" aria-hidden="true" />
              </span>
              More
            </button>
          </div>
        </div>
      </nav>

      <MobileNavSheet isAdmin={isAdmin} />
    </>
  )
}

export function MobileNavFallback() {
  return null
}
