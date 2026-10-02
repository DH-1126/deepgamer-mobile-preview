import { describe, expect, it, vi } from 'vitest'
import {
  connectRestoredLinkedRuntime,
  parseRestoredRuntimeEnvelope,
  type RestoredLinkedActor,
} from './restoredLinkedStartup'

const sourceSha256 = 'a'.repeat(64)
const contractSha256 = 'b'.repeat(64)
const actor: RestoredLinkedActor = {
  managementId: 'demo-user-001',
  displayName: '本地演示用户',
  sellerRef: 'seller-001',
  recyclerId: null,
}

const runtimeEnvelope = {
  data: {
    status: 'ready',
    service: 'restoration-admin-api',
    runtimeId: 'restoration-0123456789abcdef',
    sourceSha256,
    contract: { version: '1.2.3-restore.abc123', sourceSha256: contractSha256 },
    builtAt: '2026-09-23T10:00:00.000Z',
  },
}

describe('restored runtime identification', () => {
  it('accepts and exposes the complete restoration runtime identity', () => {
    expect(parseRestoredRuntimeEnvelope(runtimeEnvelope)).toEqual(runtimeEnvelope.data)
  })

  it.each([
    { ...runtimeEnvelope, data: { ...runtimeEnvelope.data, status: 'starting' } },
    { ...runtimeEnvelope, data: { ...runtimeEnvelope.data, service: 'admin-api' } },
    { ...runtimeEnvelope, data: { ...runtimeEnvelope.data, runtimeId: 'runtime-unknown' } },
    { ...runtimeEnvelope, data: { ...runtimeEnvelope.data, sourceSha256: 'short' } },
    { ...runtimeEnvelope, data: { ...runtimeEnvelope.data, builtAt: 'not-a-date' } },
  ])('fails closed for an unrecognized runtime', (payload) => {
    expect(() => parseRestoredRuntimeEnvelope(payload)).toThrow(/restoration runtime/i)
  })
})

describe('restored-linked startup handshake', () => {
  it('identifies runtime, opens a client-only session with {}, and reads the explicit actor', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(runtimeEnvelope))
      .mockResolvedValueOnce(Response.json({
        data: {
          mode: 'LOCAL_DEMO',
          actor,
          csrfToken: 'csrf-token-from-client-session',
          expiresAt: '2026-09-23T11:00:00.000Z',
        },
      }))
      .mockResolvedValueOnce(Response.json({ data: { mode: 'LOCAL_DEMO', actor } }))

    const connected = await connectRestoredLinkedRuntime(fetcher)

    expect(fetcher.mock.calls).toEqual([
      ['/api/v1/health/runtime', {
        method: 'GET', credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' },
      }],
      ['/api/v1/client/session', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { accept: 'application/json', 'content-type': 'application/json' }, body: '{}',
      }],
      ['/api/v1/client/session/me', {
        method: 'GET', credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' },
      }],
    ])
    expect(fetcher.mock.calls.flatMap(([url]) => String(url))).not.toContain('/api/v1/auth/login')
    expect(connected.runtime).toEqual(runtimeEnvelope.data)
    expect(connected.actor).toEqual(actor)
    expect(connected.csrfToken).toBe('csrf-token-from-client-session')
  })

  it('does not create a session when runtime identity validation fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({
      data: { ...runtimeEnvelope.data, service: 'unknown-service' },
    }))

    await expect(connectRestoredLinkedRuntime(fetcher)).rejects.toThrow(/restoration runtime/i)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects a session/me response without an explicit configured actor', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json(runtimeEnvelope))
      .mockResolvedValueOnce(Response.json({
        data: { mode: 'LOCAL_DEMO', actor, csrfToken: 'csrf', expiresAt: '2026-09-23T11:00:00.000Z' },
      }))
      .mockResolvedValueOnce(Response.json({ data: { mode: 'LOCAL_DEMO', actor: null } }))

    await expect(connectRestoredLinkedRuntime(fetcher)).rejects.toThrow(/explicit client actor/i)
  })
})
