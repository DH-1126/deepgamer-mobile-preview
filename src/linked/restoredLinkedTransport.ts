import type { RestoredLinkedConnection } from './restoredLinkedStartup'

export class RestoredHttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly outcome: 'FAILED' | 'UNKNOWN' = 'FAILED') {
    super(message)
    this.name = 'RestoredHttpError'
  }
}
type Fetcher = typeof globalThis.fetch
export type RestoredEnvelope<T> = { data: T; meta?: Record<string, unknown> }
type Parse<T> = (value: unknown) => T

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function clientPath(path: string): string {
  const pathname = path.split('?')[0]
  if (!path.startsWith('/client/') || /[\\#\s\u0000-\u001f]/u.test(path)
    || /%(?:2e|2f|5c|25)/iu.test(pathname) || pathname.split('/').some(part => part === '.' || part === '..')) {
    throw new RestoredHttpError(0, 'CLIENT_PATH_NOT_ALLOWED', '仅允许客户端专用接口')
  }
  return `/api/v1${path}`
}

/** No administrator login, persistence, fixture fallback, or automatic write retry. */
export function createRestoredLinkedTransport(connection: RestoredLinkedConnection, options: { fetcher?: Fetcher; timeoutMs?: number; onUnauthorized?: () => void } = {}) {
  const fetcher = options.fetcher ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 15_000
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid client request timeout')
  const csrfToken = connection.csrfToken
  const expiresAt = Date.parse(connection.expiresAt)
  let authorized = Number.isFinite(expiresAt) && csrfToken.length > 0

  async function request<T>(path: string, method: 'GET' | 'POST', parse: Parse<T>, signal?: AbortSignal, body?: unknown, key?: string, publishedGameCode?: string): Promise<RestoredEnvelope<T>> {
    const url = publishedGameCode === undefined ? clientPath(path) : `/api/v1/catalog/game-config/${publishedGameCode}/PUBLISH`
    if (!authorized || expiresAt <= Date.now()) {
      options.onUnauthorized?.()
      throw new RestoredHttpError(401, 'CLIENT_SESSION_REQUIRED', '客户端会话已失效，请重新连接')
    }
    const writing = method === 'POST'
    if (writing && (typeof key !== 'string' || !/^[\x21-\x7e]{8,100}$/u.test(key))) {
      throw new RestoredHttpError(0, 'CLIENT_IDEMPOTENCY_REQUIRED', '写入必须使用固定的操作重试键')
    }
    if (signal?.aborted) throw new RestoredHttpError(0, 'CLIENT_REQUEST_ABORTED', '请求已取消')
    const serialized = writing ? JSON.stringify(body) : undefined
    const headers: Record<string, string> = { accept: 'application/json' }
    if (writing) Object.assign(headers, { 'content-type': 'application/json', 'x-csrf-token': csrfToken, 'idempotency-key': key })
    const controller = new AbortController()
    let aborted: RestoredHttpError | null = null
    let rejectAbort!: (error: RestoredHttpError) => void
    const abortedPromise = new Promise<never>((_resolve, reject) => { rejectAbort = reject })
    const abort = (code: string, message: string) => {
      if (aborted) return
      aborted = new RestoredHttpError(0, code, message, writing ? 'UNKNOWN' : 'FAILED')
      rejectAbort(aborted)
      controller.abort()
    }
    const onAbort = () => abort('CLIENT_REQUEST_ABORTED', '请求已取消')
    signal?.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => abort('CLIENT_REQUEST_TIMEOUT', writing ? '操作结果未知，请查询原操作结果' : '读取超时，请重试'), timeoutMs)
    try {
      const response = await Promise.race([fetcher(url, {
        method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers, body: serialized, signal: controller.signal,
      }), abortedPromise])
      if (aborted) throw aborted
      if (response.status === 401) { authorized = false; options.onUnauthorized?.() }
      const payload: unknown = await Promise.race([response.json().catch(() => null), abortedPromise])
      if (aborted) throw aborted
      if (!response.ok) {
        const problem = object(payload)
        throw new RestoredHttpError(response.status,
          typeof problem?.code === 'string' ? problem.code : 'CLIENT_HTTP_FAILED',
          typeof problem?.detail === 'string' ? problem.detail : `客户端接口请求失败（${response.status}）`,
          writing && (response.status >= 500 || response.status === 408) ? 'UNKNOWN' : 'FAILED')
      }
      const envelope = object(payload)
      try {
        if (!envelope || !Object.hasOwn(envelope, 'data') || (envelope.meta !== undefined && !object(envelope.meta))) throw new Error('Invalid envelope')
        return { data: parse(envelope.data), meta: envelope.meta as Record<string, unknown> | undefined }
      } catch {
        throw new RestoredHttpError(response.status, 'CLIENT_RESPONSE_INVALID', '接口数据不符合已确认契约', writing ? 'UNKNOWN' : 'FAILED')
      }
    } catch (error) {
      if (aborted) throw aborted
      if (error instanceof RestoredHttpError) throw error
      throw new RestoredHttpError(0, 'CLIENT_NETWORK_FAILED', writing ? '网络中断，操作结果未知，请查询原操作结果' : '网络不可用，请重试', writing ? 'UNKNOWN' : 'FAILED')
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }
  return {
    read<T>(path: string, parse: Parse<T>, signal?: AbortSignal) { return request(path, 'GET', parse, signal) },
    write<T>(path: string, body: unknown, key: string, parse: Parse<T>, signal?: AbortSignal) { return request(path, 'POST', parse, signal, body, key) },
    async readPublishedGameConfig<T>(gameCode: string, parse: Parse<T>, signal?: AbortSignal) {
      if (!/^[a-zA-Z0-9_-]{1,40}$/u.test(gameCode)) throw new RestoredHttpError(0, 'CLIENT_PATH_NOT_ALLOWED', '游戏标识无效')
      return request('', 'GET', parse, signal, undefined, undefined, gameCode)
    },
  }
}

function cancellablePage<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return pending
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort)
      reject(new RestoredHttpError(0, 'CLIENT_REQUEST_ABORTED', '请求已取消'))
    }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

/** Collect every reported page and reject observable truncation/duplication/drift.
 * Offset pagination is not a point-in-time DB snapshot; writes must revalidate server versions.
 */
export async function collectRestoredPages<T>(load: (page: number, signal?: AbortSignal) => Promise<RestoredEnvelope<T[]>>, key: (row: T) => string, signal?: AbortSignal): Promise<T[]> {
  const rows: T[] = []
  const seen = new Set<string>()
  let expectedTotal: number | undefined
  let expectedSize: number | undefined
  for (let page = 1; ; page++) {
    if (signal?.aborted) throw new RestoredHttpError(0, 'CLIENT_REQUEST_ABORTED', '请求已取消')
    const { data, meta } = await cancellablePage(load(page, signal), signal)
    if (signal?.aborted) throw new RestoredHttpError(0, 'CLIENT_REQUEST_ABORTED', '请求已取消')
    const total = meta?.total, size = meta?.pageSize
    if (!Array.isArray(data) || meta?.page !== page || typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0
      || typeof size !== 'number' || !Number.isSafeInteger(size) || size < 1 || size > 100
      || (expectedTotal !== undefined && expectedTotal !== total) || (expectedSize !== undefined && expectedSize !== size)) {
      throw new RestoredHttpError(0, 'CLIENT_PAGINATION_INVALID', '分页结果变化或格式异常，请重新加载')
    }
    expectedTotal = total; expectedSize = size
    if (data.length !== Math.min(size, total - rows.length)) throw new RestoredHttpError(0, 'CLIENT_PAGE_INCOMPLETE', '列表返回不完整，请重新加载')
    for (const row of data) {
      const id = key(row)
      if (!id || seen.has(id)) throw new RestoredHttpError(0, 'CLIENT_PAGE_REPEATED', '列表出现重复记录，请重新加载')
      seen.add(id); rows.push(row)
    }
    if (rows.length === total) return rows
  }
}
