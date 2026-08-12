"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { useAuthStore } from "@/stores/auth-store"

export default function RootPage() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    router.replace(user ? "/dashboard" : "/login")
  }, [user, router])

  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
    </div>
  )
}