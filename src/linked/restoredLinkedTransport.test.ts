import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRestoredLinkedTransport, collectRestoredPages, RestoredHttpError } from './restoredLinkedTransport'
import type { RestoredLinkedConnection } from './restoredLinkedStartup'

const connection: RestoredLinkedConnection = {
  runtime: { status: 'ready', service: 'restoration-admin-api', runtimeId: 'restoration-0123456789abcdef',
    sourceSha256: 'a'.repeat(64), contract: { version: 'test', sourceSha256: 'b'.repeat(64) }, builtAt: '2026-09-23T10:00:00.000Z' },
  actor: { managementId: 'synthetic-owner', displayName: '合成用户', sellerRef: null, recyclerId: null },
  csrfToken: 'client-only-csrf', expiresAt: '2099-01-01T00:00:00.000Z',
}
const array = (value: unknown): { id: string }[] => {
  if (!Array.isArray(value) || value.some(item => !item || typeof item.id !== 'string')) throw new Error('invalid row')
  return value as { id: string }[]
}
const response = (data: unknown, meta?: unknown) => Response.json({ data, ...(meta ? { meta } : {}) })

afterEach(() => vi.useRealTimers())

describe('restored client-only HTTP transport', () => {
  it('reads only the exact public PUBLISH configuration without sending a write credential', async () => {
    let captured: [RequestInfo | URL, RequestInit | undefined] | undefined
    const api = createRestoredLinkedTransport(connection, { fetcher: async (url, init) => { captured = [url, init]; return response({ revisionId: 'published-one' }) } })
    expect((await api.readPublishedGameConfig('wzry', value => value)).data).toEqual({ revisionId: 'published-one' })
    expect(captured).toEqual(['/api/v1/catalog/game-config/wzry/PUBLISH', expect.objectContaining({ method: 'GET', headers: { accept: 'application/json' } })])
    await expect(api.readPublishedGameConfig('../auth/login', value => value)).rejects.toMatchObject({ code: 'CLIENT_PATH_NOT_ALLOWED' })
    await expect(api.read('/catalog/game-config/wzry/PUBLISH', value => value)).rejects.toMatchObject({ code: 'CLIENT_PATH_NOT_ALLOWED' })
  })
  it('keeps a valid empty page empty and never falls back to prototype records', async () => {
    const api = createRestoredLinkedTransport(connection, { fetcher: async () => response([], { page: 1, pageSize: 30, total: 0 }) })
    expect(await api.read('/client/orders?view=buy', array)).toEqual({ data: [], meta: { page: 1, pageSize: 30, total: 0 } })
  })

  it.each(['/auth/login', '/ops/business-user/list', 'https://example.com/api/v1/client/orders', '//example.com/client/orders',
    '/client/../auth/login', '/client/%2e%2e/auth/login', '/client/orders#fragment', '/client\\orders'])('rejects unsafe paths before fetching: %s', async path => {
    let calls = 0
    const api = createRestoredLinkedTransport(connection, { fetcher: async () => { calls++; return response([]) } })
    await expect(api.read(path, array)).rejects.toMatchObject({ code: 'CLIENT_PATH_NOT_ALLOWED' })
    expect(calls).toBe(0)
  })

  it('retains server error codes, and does not turn a server error into an empty success', async () => {
    const api = createRestoredLinkedTransport(connection, { fetcher: async () => Response.json({ code: 'READ_FAILED', detail: '读取失败' }, { status: 500 }) })
    await expect(api.read('/client/orders', array)).rejects.toMatchObject({ status: 500, code: 'READ_FAILED', message: '读取失败', outcome: 'FAILED' })
  })

  it('invalidates expired identity without attempting an administrator login', async () => {
    let calls = 0
    const api = createRestoredLinkedTransport(connection, { fetcher: async () => { calls++; return new Response(null, { status: 401 }) } })
    await expect(api.read('/client/orders', array)).rejects.toMatchObject({ status: 401 })
    await expect(api.read('/client/orders', array)).rejects.toMatchObject({ code: 'CLIENT_SESSION_REQUIRED' })
    expect(calls).toBe(1)
  })

  it('requires a replay key, and sends only client credentials without caller header overrides', async () => {
    let captured: RequestInit | undefined
    const api = createRestoredLinkedTransport(connection, { fetcher: async (_url, init) => { captured = init; return response({ id: 'operation-1' }) } })
    const parse = (value: unknown) => value as { id: string }
    await expect(api.write('/client/orders', {}, '', parse)).rejects.toMatchObject({ code: 'CLIENT_IDEMPOTENCY_REQUIRED' })
    expect(captured).toBeUndefined()
    expect(await api.write('/client/orders', { quoteId: 'quote-1' }, 'stable-operation-1', parse)).toEqual({ data: { id: 'operation-1' }, meta: undefined })
    expect(captured).toMatchObject({ method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { 'x-csrf-token': 'client-only-csrf', 'idempotency-key': 'stable-operation-1' }, body: '{"quoteId":"quote-1"}' })
  })

  it.each([response({ items: [] }), new Response('not-json'), Response.json({ rows: [] })])('rejects malformed envelopes or DTOs instead of inventing defaults', async wireResponse => {
    const api = createRestoredLinkedTransport(connection, { fetcher: async () => wireResponse })
    await expect(api.read('/client/orders', array)).rejects.toMatchObject({ code: 'CLIENT_RESPONSE_INVALID' })
  })

  it('reports a timed-out write as unknown and never automatically replays the operation', async () => {
    vi.useFakeTimers()
    let calls = 0
    const api = createRestoredLinkedTransport(connection, { timeoutMs: 50, fetcher: async (_url, init) => {
      calls++
      return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))
    } })
    const result = api.write('/client/orders/order-1/pay', { operationId: 'operation-1' }, 'stable-operation-2', value => value).catch(error => error)
    await vi.advanceTimersByTimeAsync(51)
    expect(await result).toMatchObject({ code: 'CLIENT_REQUEST_TIMEOUT', outcome: 'UNKNOWN' })
    expect(calls).toBe(1)
  })

  it('rejects cancellation even if an uncooperative network layer returns data later', async () => {
    let finish!: (response: Response) => void
    const api = createRestoredLinkedTransport(connection, { fetcher: async () => new Promise(resolve => { finish = resolve }) })
    const abort = new AbortController()
    const pending = api.read('/client/orders', array, abort.signal).catch(error => error)
    abort.abort(); finish(response([{ id: 'stale-user-order' }]))
    expect(await pending).toMatchObject({ code: 'CLIENT_REQUEST_ABORTED' })
  })
})

describe('complete page collection', () => {
  it('settles immediately on cancellation while a page loader is still pending', async () => {
    const abort = new AbortController()
    let forwarded: AbortSignal | undefined
    const pending = collectRestoredPages<{ id: string }>(async (_page, signal) => {
      forwarded = signal
      return new Promise(() => {})
    }, row => row.id, abort.signal).catch(error => error)
    abort.abort()
    const result = await Promise.race([pending, new Promise(resolve => setTimeout(() => resolve('still-pending'), 30))])
    expect(result).toMatchObject({ code: 'CLIENT_REQUEST_ABORTED' })
    expect(forwarded).toBe(abort.signal)
  })

  it('reads 61 rows over three pages and preserves order without a fixed page cap', async () => {
    const requested: number[] = []
    const rows = await collectRestoredPages(async page => {
      requested.push(page)
      const start = (page - 1) * 30
      return { data: Array.from({ length: Math.min(30, 61 - start) }, (_, index) => ({ id: `row-${start + index}` })),
        meta: { page, pageSize: 30, total: 61 } }
    }, row => row.id)
    expect(rows).toHaveLength(61); expect(rows[60]).toEqual({ id: 'row-60' }); expect(requested).toEqual([1, 2, 3])
  })

  it('reads beyond the former 20-page cap', async () => {
    const rows = await collectRestoredPages(async page => ({ data: [{ id: String(page) }], meta: { page, pageSize: 1, total: 22 } }), row => row.id)
    expect(rows).toHaveLength(22)
  })

  it.each(['duplicate', 'wrong-page', 'truncated', 'changing-total', 'no-meta'])('fails visibly on inconsistent pagination: %s', async fault => {
    await expect(collectRestoredPages(async page => ({
      data: fault === 'truncated' && page === 2 ? [] : [{ id: fault === 'duplicate' ? 'same' : String(page) }],
      meta: fault === 'no-meta' ? undefined : { page: fault === 'wrong-page' ? 1 : page, pageSize: 1, total: fault === 'changing-total' ? page + 1 : 2 },
    }), row => row.id)).rejects.toBeInstanceOf(RestoredHttpError)
  })
})
