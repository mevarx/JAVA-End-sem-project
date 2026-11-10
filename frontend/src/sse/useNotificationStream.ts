import { useEffect, useRef } from 'react'
import type { NotificationItem } from '../api/types'

/**
 * Subscribes to the server-sent notification stream. EventSource reconnects on its
 * own; the callback is kept in a ref so the connection is not torn down on every
 * render.
 */
export function useNotificationStream(onNotification: (notification: NotificationItem) => void) {
  const callback = useRef(onNotification)
  callback.current = onNotification

  useEffect(() => {
    const source = new EventSource('/api/notifications/stream', { withCredentials: true })
    const handler = (event: MessageEvent) => {
      try {
        callback.current(JSON.parse(event.data) as NotificationItem)
      } catch {
        // Ignore a malformed frame rather than breaking the stream.
      }
    }
    source.addEventListener('notification', handler as EventListener)
    return () => {
      source.removeEventListener('notification', handler as EventListener)
      source.close()
    }
  }, [])
}
