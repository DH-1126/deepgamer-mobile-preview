import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useRestoredClient } from './RestoredClientProvider'
import type { createRestoredLinkedTransport } from './restoredLinkedTransport'
import { readRestoredSeller, type RestoredSeller } from './restoredSellerApi'

type RestoredTransport = ReturnType<typeof createRestoredLinkedTransport>
type Snapshot = { seller: RestoredSeller | null; loading: boolean; error: string | null }
type Reader = (transport: RestoredTransport, signal?: AbortSignal) => Promise<RestoredSeller>

const initialSnapshot: Snapshot = { seller: null, loading: true, error: null }
const emptySubscribe = () => () => {}
const getInitialSnapshot = () => initialSnapshot

export function createRestoredSellerController(transport: RestoredTransport, options: { read?: Reader } = {}) {
  const read = options.read ?? readRestoredSeller
  const listeners = new Set<() => void>()
  let snapshot = initialSnapshot
  let active = false
  let visible = true
  let generation = 0
  let failureCount = 0
  let pending: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const publish = (next: Snapshot) => {
    snapshot = next
    listeners.forEach(listener => listener())
  }
  const clearTimer = () => { clearTimeout(timer); timer = undefined }
  const schedule = (delay: number) => {
    clearTimer()
    if (active && visible) timer = setTimeout(() => { void refresh() }, delay)
  }

  async function refresh(): Promise<void> {
    if (!active || !visible) return
    const current = ++generation
    clearTimer()
    pending?.abort()
    const controller = new AbortController()
    pending = controller
    publish({ seller: snapshot.seller, loading: snapshot.seller === null, error: snapshot.error })
    try {
      const seller = await read(transport, controller.signal)
      if (!active || !visible || current !== generation) return
      failureCount = 0
      publish({ seller, loading: false, error: null })
      schedule(5_000)
    } catch (error) {
      if (!active || !visible || current !== generation) return
      const message = error instanceof Error ? error.message : '卖家状态读取失败'
      publish({
        seller: snapshot.seller,
        loading: false,
        error: snapshot.seller ? `刷新失败，当前显示上次数据（可能已过期）：${message}` : message,
      })
      failureCount++
      schedule([5_000, 10_000, 20_000, 30_000][Math.min(failureCount - 1, 3)])
    } finally {
      if (current === generation) pending = undefined
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    start() { active = true; return visible ? refresh() : Promise.resolve() },
    refresh,
    setVisible(next: boolean) {
      if (visible === next) return Promise.resolve()
      visible = next
      generation++
      clearTimer()
      pending?.abort()
      pending = undefined
      return active && visible ? refresh() : Promise.resolve()
    },
    stop() {
      active = false
      generation++
      clearTimer()
      pending?.abort()
      pending = undefined
    },
  }
}

export function useRestoredSeller(): { seller: RestoredSeller | null; loading: boolean; error: string | null; refresh: () => Promise<void> } {
  const { transport } = useRestoredClient()
  const controller = useMemo(() => transport ? createRestoredSellerController(transport) : null, [transport])
  const snapshot = useSyncExternalStore(
    controller?.subscribe ?? emptySubscribe,
    controller?.getSnapshot ?? getInitialSnapshot,
    controller?.getSnapshot ?? getInitialSnapshot,
  )
  useEffect(() => {
    if (!controller) return undefined
    const syncVisibility = () => { void controller.setVisible(document.visibilityState === 'visible') }
    void controller.setVisible(document.visibilityState === 'visible')
    void controller.start()
    document.addEventListener('visibilitychange', syncVisibility)
    return () => { document.removeEventListener('visibilitychange', syncVisibility); controller.stop() }
  }, [controller])
  const refresh = useCallback(async () => { await controller?.refresh() }, [controller])
  return { ...snapshot, refresh }
}
