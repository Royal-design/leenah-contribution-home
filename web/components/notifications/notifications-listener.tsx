"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { getStoredSession } from "@/lib/api/session"
import { connectNotificationStream } from "@/lib/realtime"
import { playNotificationSound } from "@/lib/sound"
import { queryKeys } from "@/hooks/queries/query-keys"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Mounted inside the authenticated app shell. Opens an SSE connection to the
 * notifications stream and surfaces new events as toasts with an alert sound,
 * keeping unread counts and lists in sync.
 */
export function NotificationsListener() {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)

  React.useEffect(() => {
    if (!user) {
      return
    }

    let disposed = false
    let retryTimer: number | undefined
    let cleanup: (() => void) | undefined

    function invalidate(type: string) {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })

      if (type === "contribution") {
        queryClient.invalidateQueries({ queryKey: queryKeys.contributions.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.adminContributions.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.recent })
        queryClient.invalidateQueries({ queryKey: queryKeys.adminStats })
      } else if (type === "withdrawal") {
        queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.adminWithdrawals.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.adminStats })
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.support.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.support.unreadCount })
      }
    }

    function connect() {
      const session = getStoredSession()
      const token = session?.accessToken
      if (!token) {
        return
      }

      cleanup = connectNotificationStream(
        token,
        (event) => {
          if (event.type !== "notification") {
            return
          }
          const notification = event.notification
          invalidate(notification.type)
          playNotificationSound()
          toast(notification.title, {
            description: notification.message ?? undefined,
          })
        },
        () => {
          // Connection dropped (auth or network) — retry shortly with a fresh token.
          cleanup?.()
          cleanup = undefined
          if (!disposed) {
            retryTimer = window.setTimeout(connect, 4000)
          }
        }
      )
    }

    connect()

    return () => {
      disposed = true
      window.clearTimeout(retryTimer)
      cleanup?.()
      cleanup = undefined
    }
  }, [user, queryClient])

  return null
}
