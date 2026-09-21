"use client"

import { useRouter } from "next/navigation"
import * as React from "react"

import { FundingDialog } from "@/components/forms/funding-dialog"
import { adminNavGroups, userNavGroups } from "@/components/navigation/config"
import { DesktopSidebar } from "@/components/navigation/desktop-sidebar"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"
import { TopHeader } from "@/components/navigation/top-header"
import { NotificationsListener } from "@/components/notifications/notifications-listener"
import { PageSkeleton } from "@/components/shared/skeletons"
import { isAdmin as hasAdminAccess } from "@/lib/roles"
import { useAuthStore } from "@/stores/auth-store"

export function AppShell({
  children,
  isAdmin = false,
}: {
  children: React.ReactNode
  isAdmin?: boolean
}) {
  const router = useRouter()
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const [fundingOpen, setFundingOpen] = React.useState(false)

  const navGroups = isAdmin ? adminNavGroups : userNavGroups

  React.useEffect(() => {
    if (status === "idle") {
      return
    }

    if (!user) {
      router.replace("/login")
      return
    }

    if (isAdmin && !hasAdminAccess(user)) {
      router.replace("/dashboard")
    }
  }, [user, status, isAdmin, router])

  if (status === "idle") {
    return <PageSkeleton />
  }

  if (!user) {
    return null
  }

  if (isAdmin && !hasAdminAccess(user)) {
    return null
  }

  return (
    <div className="min-h-svh bg-sidebar">
      <NotificationsListener />
      <DesktopSidebar navGroups={navGroups} />

      <div className="lg:pl-64">
        <TopHeader isAdmin={isAdmin} />

        <main className="mx-auto max-w-7xl overflow-x-hidden px-4 pt-6 pb-32 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <div className="lg:hidden">
        <MobileBottomNav
          isAdmin={isAdmin}
          onCenterAction={() => setFundingOpen(true)}
        />
      </div>

      <FundingDialog open={fundingOpen} onOpenChange={setFundingOpen} />
    </div>
  )
}
