import { describe, expect, it } from 'vitest'
import packageJson from './package.json'
import {
  LEGACY_PUBLIC_CATALOG_TARGET,
  RESTORED_LINKED_API_TARGET,
  RESTORED_LINKED_ORIGIN,
  authorizeRestoredProxyRequest,
  createFrontendViteConfig,
  resolveFrontendDevBoundary,
  resolveRestoredLinkedTarget,
} from './vite.config'

describe('restored-linked dev boundary', () => {
  it('exposes a distinct 5175 restored-linked command without changing the 5174 default command', () => {
    expect(packageJson.scripts.dev).toBe('vite --host 0.0.0.0 --port 5174 --strictPort')
    expect(packageJson.scripts['dev:restored-linked']).toBe(
      'VITE_DATA_MODE=restored-linked vite --mode restored-linked --host 127.0.0.1 --port 5175 --strictPort',
    )
  })

  it('keeps the default 5174 development mode isolated from the restored API', () => {
    expect(resolveFrontendDevBoundary('development')).toEqual({
      kind: 'mock',
      host: '0.0.0.0',
      port: 5174,
    })
  })

  it.each(['development', 'production'])('keeps only the existing public catalog proxy in %s mode', (mode) => {
    const config = createFrontendViteConfig(mode, {})
    expect(config.server.proxy).toEqual({
      '/api/v1/catalog': { target: LEGACY_PUBLIC_CATALOG_TARGET, changeOrigin: false },
    })
    expect(config.server).toMatchObject({ host: '0.0.0.0', port: 5174, strictPort: true })
    expect(config.plugins).toHaveLength(1)
  })

  it('installs only the allowlisted 8786 proxy in the explicit restored mode', () => {
    const config = createFrontendViteConfig('restored-linked', {})
    expect(config.server).toMatchObject({ host: '127.0.0.1', port: 5175, strictPort: true })
    expect(config.server.proxy).toEqual({
      '/api': { target: RESTORED_LINKED_API_TARGET, changeOrigin: false, ws: false },
    })
    expect(config.plugins).toHaveLength(2)
    expect(config.plugins[1]).toMatchObject({ name: 'restored-linked-proxy-guard' })
  })

  it('binds a restored production build to the restored app without requiring a second environment flag', () => {
    expect(createFrontendViteConfig('restored-linked', {}).define).toEqual({ 'import.meta.env.VITE_DATA_MODE': '"restored-linked"' })
    expect(createFrontendViteConfig('production', {}).define).toEqual({})
  })

  it('binds the explicit mode to 127.0.0.1:5175 and the fixed 8786 runtime', () => {
    expect(resolveFrontendDevBoundary('restored-linked')).toEqual({
      kind: 'restored-linked',
      host: '127.0.0.1',
      port: 5175,
      target: RESTORED_LINKED_API_TARGET,
    })
  })

  it.each([
    'http://127.0.0.1:8780',
    'http://localhost:8786',
    'https://127.0.0.1:8786',
    'http://127.0.0.1:8786/api',
    'http://user:secret@127.0.0.1:8786',
    'http://192.168.1.8:8786',
  ])('rejects an unsafe or incorrect target: %s', (target) => {
    expect(() => resolveRestoredLinkedTarget(target)).toThrow(/127\.0\.0\.1:8786/)
  })
})

describe('restored-linked proxy allowlist', () => {
  it.each([
    ['GET', '/api/v1/client/session/me'],
    ['POST', '/api/v1/client/session'],
    ['GET', '/api/v1/client/catalog/games?status=active'],
    ['GET', '/api/v1/catalog/title-config/wzry'],
    ['GET', '/api/v1/catalog/game-config/wzry/DETAIL'],
    ['GET', '/api/v1/health/runtime'],
  ])('allows %s %s from the configured user origin', (method, url) => {
    expect(authorizeRestoredProxyRequest({ method, url, origin: RESTORED_LINKED_ORIGIN })).toEqual({
      allowed: true,
      forwardedOrigin: RESTORED_LINKED_ORIGIN,
    })
  })

  it.each([
    ['POST', '/api/v1/auth/login'],
    ['GET', '/api/v1/game-management/games'],
    ['GET', '/api/v1/ops/orders'],
    ['DELETE', '/api/v1/client/orders/order-1'],
    ['POST', '/api/v1/health/runtime'],
    ['POST', '/api/v1/catalog/title-config/wzry'],
  ])('denies non-client administration or a disallowed method: %s %s', (method, url) => {
    expect(authorizeRestoredProxyRequest({ method, url, origin: RESTORED_LINKED_ORIGIN }).allowed).toBe(false)
  })

  it('rejects an unknown Origin instead of laundering it into the configured Origin', () => {
    expect(authorizeRestoredProxyRequest({
      method: 'POST',
      url: '/api/v1/client/session',
      origin: 'http://attacker.example',
    })).toEqual({ allowed: false, status: 403, code: 'RESTORED_LINKED_ORIGIN_REJECTED' })
  })

  it('preserves a missing Origin for read requests so the API, not the proxy, remains authoritative', () => {
    expect(authorizeRestoredProxyRequest({ method: 'GET', url: '/api/v1/health/runtime' })).toEqual({
      allowed: true,
      forwardedOrigin: undefined,
    })
  })
})
