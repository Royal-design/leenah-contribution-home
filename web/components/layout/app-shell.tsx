"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"

import { DesktopSidebar } from "@/components/navigation/desktop-sidebar"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"
import { TopHeader } from "@/components/navigation/top-header"
import { FundingDialog } from "@/components/forms/funding-dialog"
import { adminNavGroups, userNavGroups } from "@/components/navigation/config"
import { useAuthStore } from "@/stores/auth-store"
import { cn } from "@/lib/utils"
import type { NavItem } from "@/components/navigation/config"

export function AppShell({
  children,
  isAdmin = false,
}: {
  children: React.ReactNode
  isAdmin?: boolean
}) {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const [fundingOpen, setFundingOpen] = React.useState(false)

  const navGroups = isAdmin ? adminNavGroups : userNavGroups

  React.useEffect(() => {
    if (!user) {
      router.replace("/login")
      return
    }

    if (isAdmin && user.role !== "admin") {
      router.replace("/dashboard")
    }
  }, [user, isAdmin, router])

  if (!user) {
    return null
  }

  if (isAdmin && user.role !== "admin") {
    return null
  }

  const backHref = isAdmin ? "/admin/dashboard" : "/dashboard"

  return (
    <div className="min-h-svh bg-muted/30">
      <DesktopSidebar navGroups={navGroups} />

      <div className="lg:pl-64">
        <TopHeader isAdmin={isAdmin} />

        <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <div className="lg:hidden">
        <MobileBottomNav onCenterAction={() => setFundingOpen(true)} />
      </div>

      <FundingDialog
        open={fundingOpen}
        onOpenChange={setFundingOpen}
      />
    </div>
  )
}