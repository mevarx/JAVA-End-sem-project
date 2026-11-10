import { useEffect, useRef } from 'react'

export const DATA_CHANGED_EVENT = 'haes:data-changed'

/** Re-runs the callback whenever the SSE layer reports any notification. */
export function useLiveRefresh(callback: () => void) {
  const ref = useRef(callback)
  ref.current = callback
  useEffect(() => {
    const handler = () => ref.current()
    window.addEventListener(DATA_CHANGED_EVENT, handler)
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handler)
  }, [])
}

/** Polls a callback on an interval; pauses while the browser tab is hidden. */
export function usePoll(callback: () => void, intervalMs: number, enabled = true) {
  const ref = useRef(callback)
  ref.current = callback
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => {
      if (!document.hidden) ref.current()
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs, enabled])
}
