"use client"

import {
  Bell,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getInitials } from "@/lib/format"
import { isAdmin as hasAdminAccess } from "@/lib/roles"
import { useNotificationsUnreadCount } from "@/hooks/queries/use-transactions"
import { useAuthStore } from "@/stores/auth-store"

export function UserMenu({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  if (!user) return null

  function handleLogout() {
    logout()
    router.push("/login")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Open account menu"
            className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Avatar>
              <AvatarImage
                src={user.avatar}
                alt={`${user.firstName} ${user.lastName}`}
              />
              <AvatarFallback>
                {getInitials(user.firstName, user.lastName)}
              </AvatarFallback>
            </Avatar>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <p className="text-sm font-medium">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs font-normal text-muted-foreground">
              {user.email}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {hasAdminAccess(user) && (
            <>
              <DropdownMenuItem
                onClick={() =>
                  router.push(isAdmin ? "/dashboard" : "/admin/dashboard")
                }
              >
                {isAdmin ? <LayoutDashboard /> : <ShieldCheck />}
                {isAdmin
                  ? "Switch to user dashboard"
                  : "Switch to admin dashboard"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onClick={() =>
              router.push(isAdmin ? "/admin/profile" : "/profile")
            }
          >
            <User />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(isAdmin ? "/admin/settings" : "/settings")}
          >
            <Settings />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function RoleSwitcher({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)

  if (!user || !hasAdminAccess(user)) {
    return null
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => router.push(isAdmin ? "/dashboard" : "/admin/dashboard")}
    >
      {isAdmin ? (
        <>
          <LayoutDashboard />
          Switch to user view
        </>
      ) : (
        <>
          <ShieldCheck />
          Switch to admin view
        </>
      )}
    </Button>
  )
}

export function TopHeader({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const { data: unreadCount } = useNotificationsUnreadCount()
  const unread = unreadCount ?? 0

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {isAdmin ? "Admin" : "Dashboard"}
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:block">
          <RoleSwitcher isAdmin={isAdmin} />
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
          onClick={() =>
            router.push(isAdmin ? "/admin/notifications" : "/notifications")
          }
          className="relative"
        >
          <Bell className="size-4" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.6rem] font-semibold leading-4 text-white ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
        <UserMenu isAdmin={isAdmin} />
      </div>
    </header>
  )
}
