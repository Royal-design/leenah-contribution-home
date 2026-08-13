import type { NotificationType } from "@/types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"

export interface StreamNotification {
  id?: string
  type: NotificationType
  title: string
  message?: string | null
  is_read?: boolean
  created_at?: string
}

export interface RealtimeEvent {
  type: "notification"
  notification: StreamNotification
}

/**
 * Opens an SSE connection to the notifications stream.
 * Returns a cleanup function that closes the connection.
 */
export function connectNotificationStream(
  token: string,
  onEvent: (event: RealtimeEvent) => void,
  onError?: () => void
): () => void {
  if (typeof window === "undefined") {
    return () => {}
  }
  const url = `${API_BASE}/api/notifications/stream?token=${encodeURIComponent(token)}`
  const source = new EventSource(url)

  source.onmessage = (event) => {
    if (event.data.startsWith("{")) {
      try {
        const payload = JSON.parse(event.data) as RealtimeEvent
        onEvent(payload)
      } catch {
        // ignore malformed frames
      }
    }
  }

  source.onerror = () => {
    onError?.()
  }

  return () => {
    source.close()
  }
}
