import { connectRestoredLinkedRuntime, type RestoredLinkedConnection } from './restoredLinkedStartup'
import { createRestoredLinkedTransport } from './restoredLinkedTransport'

export interface RestoredClientSnapshot {
  status: 'loading' | 'ready' | 'error'
  connection: RestoredLinkedConnection | null
  transport: ReturnType<typeof createRestoredLinkedTransport> | null
  error: string | null
}
export const initialRestoredClientSnapshot: RestoredClientSnapshot = { status: 'loading', connection: null, transport: null, error: null }

/** Connection-scoped state only. Never writes the prototype login repository. */
export function createRestoredClientController(options: { fetcher?: typeof fetch; timeoutMs?: number } = {}) {
  let snapshot = initialRestoredClientSnapshot
  let generation = 0
  let pending: AbortController | undefined
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  const listeners = new Set<() => void>()
  const publish = (next: RestoredClientSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }
  const clear = () => { pending?.abort(); pending = undefined; clearTimeout(expiryTimer); expiryTimer = undefined }
  const fail = (error: string) => { clearTimeout(expiryTimer); publish({ status: 'error', connection: null, transport: null, error }) }

  async function connect() {
    const current = ++generation
    clear()
    publish(initialRestoredClientSnapshot)
    const controller = new AbortController()
    pending = controller
    let rejectAbort!: (reason: Error) => void
    const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject })
    const onAbort = () => rejectAbort(new Error('连接已取消'))
    controller.signal.addEventListener('abort', onAbort, { once: true })
    const timeout = setTimeout(() => { rejectAbort(new Error('连接超时，请重试')); controller.abort() }, options.timeoutMs ?? 15_000)
    const fetcher: typeof fetch = (url, init) => Promise.race([
      (options.fetcher ?? globalThis.fetch)(url, { ...init, signal: controller.signal, redirect: 'error' }), aborted,
    ])
    try {
      const connection = await Promise.race([connectRestoredLinkedRuntime(fetcher), aborted])
      if (current !== generation) return
      const remaining = Date.parse(connection.expiresAt) - Date.now()
      if (!(remaining > 0)) throw new Error('客户端会话已失效，请重新连接')
      const transport = createRestoredLinkedTransport(connection, {
        fetcher: options.fetcher,
        onUnauthorized: () => { if (current === generation) fail('客户端会话已失效，请重新连接') },
      })
      publish({ status: 'ready', connection, transport, error: null })
      // Browsers cap timers at a signed 32-bit delay; recheck long-lived sessions.
      const checkExpiry = () => {
        if (current !== generation) return
        const delay = Date.parse(connection.expiresAt) - Date.now()
        if (delay <= 0) fail('客户端会话已失效，请重新连接')
        else expiryTimer = setTimeout(checkExpiry, Math.min(delay, 2_147_483_647))
      }
      checkExpiry()
    } catch (error) {
      if (current === generation) fail(error instanceof Error ? error.message : '联动连接失败，请重试')
    } finally {
      clearTimeout(timeout)
      controller.signal.removeEventListener('abort', onAbort)
      if (current === generation) pending = undefined
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    connect,
    disconnect() { generation++; clear(); publish(initialRestoredClientSnapshot) },
  }
}
