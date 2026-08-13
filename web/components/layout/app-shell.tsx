"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { DesktopSidebar } from "@/components/navigation/desktop-sidebar"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"
import { TopHeader } from "@/components/navigation/top-header"
import { FundingDialog } from "@/components/forms/funding-dialog"
import { PageSkeleton } from "@/components/shared/skeletons"
import { adminNavGroups, userNavGroups } from "@/components/navigation/config"
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

    if (isAdmin && user.role !== "admin") {
      router.replace("/dashboard")
    }
  }, [user, status, isAdmin, router])

  if (status === "idle") {
    return <PageSkeleton />
  }

  if (!user) {
    return null
  }

  if (isAdmin && user.role !== "admin") {
    return null
  }

  return (
    <div className="min-h-svh bg-muted/30">
      <DesktopSidebar navGroups={navGroups} />

      <div className="lg:pl-64">
        <TopHeader isAdmin={isAdmin} />

        <main className="mx-auto max-w-7xl overflow-x-hidden px-4 pb-32 pt-6 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <div className="lg:hidden">
        <MobileBottomNav
          isAdmin={isAdmin}
          onCenterAction={() => setFundingOpen(true)}
        />
      </div>

      <FundingDialog
        open={fundingOpen}
        onOpenChange={setFundingOpen}
      />
    </div>
  )
}