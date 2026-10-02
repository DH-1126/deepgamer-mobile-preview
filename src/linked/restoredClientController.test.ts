import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRestoredClientController } from './restoredClientController'

const runtime = { status: 'ready', service: 'restoration-admin-api', runtimeId: 'restoration-0123456789abcdef', sourceSha256: 'a'.repeat(64), contract: { version: 'test', sourceSha256: 'b'.repeat(64) }, builtAt: '2026-09-23T10:00:00.000Z' }
const actor = { managementId: 'synthetic-owner', displayName: '合成用户', sellerRef: null, recyclerId: null }
function success(url: RequestInfo | URL, expiresAt = '2099-01-01T00:00:00.000Z') {
  const data = String(url).endsWith('/runtime') ? runtime : String(url).endsWith('/session')
    ? { mode: 'LOCAL_DEMO', actor, csrfToken: 'test-client-csrf', expiresAt } : { mode: 'LOCAL_DEMO', actor }
  return Response.json({ data })
}
afterEach(() => vi.useRealTimers())

describe('restored client connection lifecycle', () => {
  it('exposes only the service-bound actor after completing the handshake', async () => {
    const paths: string[] = []
    const client = createRestoredClientController({ fetcher: async url => { paths.push(String(url)); return success(url) } })
    expect(client.getSnapshot().status).toBe('loading')
    expect(client.getSnapshot().connection).toBeNull()
    await client.connect()
    expect(client.getSnapshot().connection?.actor).toEqual(actor)
    expect(client.getSnapshot().status).toBe('ready')
    expect(paths).toEqual(['/api/v1/health/runtime', '/api/v1/client/session', '/api/v1/client/session/me'])
    client.disconnect()
  })

  it('keeps failed startup explicit and supports a new explicit connection attempt', async () => {
    let unavailable = true
    const client = createRestoredClientController({ fetcher: async url => unavailable ? new Response(null, { status: 503 }) : success(url) })
    await client.connect()
    expect(client.getSnapshot()).toMatchObject({ status: 'error', connection: null, transport: null })
    unavailable = false
    await client.connect()
    expect(client.getSnapshot().status).toBe('ready')
    client.disconnect()
  })

  it('does not let a late handshake replace a newer connection', async () => {
    let finish!: (value: Response) => void
    let first = true
    const client = createRestoredClientController({ fetcher: async url => {
      if (first) { first = false; return new Promise(resolve => { finish = resolve }) }
      return success(url)
    } })
    const old = client.connect()
    await client.connect()
    finish(new Response(null, { status: 503 }))
    await old
    expect(client.getSnapshot().status).toBe('ready')
    client.disconnect()
  })

  it('invalidates identity when a business request reports 401 without automatic reconnect', async () => {
    const paths: string[] = []
    const client = createRestoredClientController({ fetcher: async url => {
      paths.push(String(url))
      return String(url).endsWith('/seller') ? new Response(null, { status: 401 }) : success(url)
    } })
    await client.connect()
    const transport = client.getSnapshot().transport!
    await expect(transport.read('/client/seller', value => value)).rejects.toMatchObject({ status: 401 })
    expect(client.getSnapshot()).toMatchObject({ status: 'error', connection: null, transport: null })
    expect(paths.filter(path => path.endsWith('/session'))).toHaveLength(1)
    client.disconnect()
  })

  it('times out stalled startup rather than keeping protected pages in loading forever', async () => {
    vi.useFakeTimers()
    const client = createRestoredClientController({ fetcher: () => new Promise(() => {}), timeoutMs: 50 })
    const connected = client.connect()
    await vi.advanceTimersByTimeAsync(51)
    await connected
    expect(client.getSnapshot()).toMatchObject({ status: 'error', connection: null })
    expect(client.getSnapshot().error).toMatch(/超时/)
    client.disconnect()
  })

  it('expires the protected identity on time even before the next business request', async () => {
    vi.useFakeTimers()
    const expires = new Date(Date.now() + 1000).toISOString()
    const client = createRestoredClientController({ fetcher: async url => success(url, expires) })
    await client.connect()
    await vi.advanceTimersByTimeAsync(1001)
    expect(client.getSnapshot()).toMatchObject({ status: 'error', connection: null, transport: null })
    client.disconnect()
  })
})
