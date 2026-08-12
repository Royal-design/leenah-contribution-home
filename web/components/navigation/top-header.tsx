"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, LogOut, Settings, User } from "lucide-react"

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
              <AvatarImage src={user.avatar} alt={`${user.firstName} ${user.lastName}`} />
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
            <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => router.push(isAdmin ? "/admin/settings" : "/profile")}
          >
            <User />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings")}>
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

export function TopHeader({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter()
  const notifications = useAuthStore((state) => state.user)

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
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          onClick={() =>
            router.push(isAdmin ? "/admin/dashboard" : "/notifications")
          }
        >
          <Bell className="size-4" aria-hidden="true" />
        </Button>
        <UserMenu isAdmin={isAdmin} />
      </div>
    </header>
  )
}