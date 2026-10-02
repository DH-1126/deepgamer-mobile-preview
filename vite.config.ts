import { defineConfig, type Plugin, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> }

export const RESTORED_LINKED_MODE = 'restored-linked'
export const RESTORED_LINKED_API_TARGET = 'http://127.0.0.1:8786'
export const RESTORED_LINKED_ORIGIN = 'http://127.0.0.1:5175'
export const LEGACY_PUBLIC_CATALOG_TARGET = 'http://127.0.0.1:8780'

export type FrontendDevBoundary =
  | { kind: 'mock'; host: '0.0.0.0'; port: 5174 }
  | { kind: 'restored-linked'; host: '127.0.0.1'; port: 5175; target: typeof RESTORED_LINKED_API_TARGET }

export type RestoredProxyDecision =
  | { allowed: true; forwardedOrigin: string | undefined }
  | { allowed: false; status: 403 | 404 | 405; code: string }

export function resolveRestoredLinkedTarget(candidate = RESTORED_LINKED_API_TARGET): typeof RESTORED_LINKED_API_TARGET {
  let target: URL
  try {
    target = new URL(candidate)
  } catch {
    throw new Error(`restored-linked target must be exactly ${RESTORED_LINKED_API_TARGET}`)
  }
  const exactLocalTarget = target.protocol === 'http:'
    && target.hostname === '127.0.0.1'
    && target.port === '8786'
    && target.username === ''
    && target.password === ''
    && target.pathname === '/'
    && target.search === ''
    && target.hash === ''
    && target.origin === RESTORED_LINKED_API_TARGET
  if (!exactLocalTarget) {
    throw new Error(`restored-linked target must be exactly ${RESTORED_LINKED_API_TARGET}`)
  }
  return RESTORED_LINKED_API_TARGET
}

export function resolveFrontendDevBoundary(mode: string, target?: string): FrontendDevBoundary {
  if (mode !== RESTORED_LINKED_MODE) return { kind: 'mock', host: '0.0.0.0', port: 5174 }
  return {
    kind: 'restored-linked',
    host: '127.0.0.1',
    port: 5175,
    target: resolveRestoredLinkedTarget(target),
  }
}

function pathFor(rawUrl: string): string | null {
  if (!rawUrl.startsWith('/') || /%(?:2f|5c|2e)/iu.test(rawUrl)) return null
  try {
    return new URL(rawUrl, RESTORED_LINKED_ORIGIN).pathname
  } catch {
    return null
  }
}

function allowedMethods(path: string): ReadonlySet<string> | null {
  if (/^\/api\/v1\/client\/.+/u.test(path)) return new Set(['GET', 'POST'])
  if (/^\/api\/v1\/catalog\/title-config\/[^/]+$/u.test(path)) return new Set(['GET'])
  if (/^\/api\/v1\/catalog\/game-config\/[^/]+\/[^/]+$/u.test(path)) return new Set(['GET'])
  if (path === '/api/v1/health/runtime') return new Set(['GET'])
  return null
}

export function authorizeRestoredProxyRequest(input: {
  method: string
  url: string
  origin?: string
}): RestoredProxyDecision {
  if (input.origin !== undefined && input.origin !== RESTORED_LINKED_ORIGIN) {
    return { allowed: false, status: 403, code: 'RESTORED_LINKED_ORIGIN_REJECTED' }
  }
  const path = pathFor(input.url)
  const methods = path === null ? null : allowedMethods(path)
  if (methods === null) return { allowed: false, status: 404, code: 'RESTORED_LINKED_PATH_REJECTED' }
  if (!methods.has(input.method.toUpperCase())) {
    return { allowed: false, status: 405, code: 'RESTORED_LINKED_METHOD_REJECTED' }
  }
  return { allowed: true, forwardedOrigin: input.origin }
}

/** Runs before Vite's proxy and fails closed outside the restored client allowlist. */
export function restoredLinkedProxyGuardPlugin(): Plugin {
  return {
    name: 'restored-linked-proxy-guard',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const incoming = request as unknown as {
          url?: string
          method?: string
          headers: { origin?: string | string[] }
        }
        if (incoming.url !== '/api' && !incoming.url?.startsWith('/api/')) {
          next()
          return
        }
        const rawOrigin = incoming.headers.origin
        const decision = authorizeRestoredProxyRequest({
          method: incoming.method ?? '',
          url: incoming.url,
          origin: Array.isArray(rawOrigin) ? rawOrigin.join(',') : rawOrigin,
        })
        if (decision.allowed) {
          next()
          return
        }
        response.statusCode = decision.status
        response.setHeader('content-type', 'application/json; charset=utf-8')
        if (decision.status === 405) response.setHeader('allow', 'GET, POST')
        response.end(JSON.stringify({ error: decision.code }))
      })
    },
  }
}

export function createFrontendViteConfig(mode: string, environment: Record<string, string | undefined> = process.env) {
  const boundary = resolveFrontendDevBoundary(mode, environment.RESTORED_LINKED_API_TARGET)
  const restoredLinked = boundary.kind === 'restored-linked'
  const proxy: Record<string, ProxyOptions> = restoredLinked ? {
    '/api': {
      target: boundary.target,
      changeOrigin: false,
      ws: false,
    },
  } : {
    // Preserve the existing 5174 mock/public-title behavior. This is not a restoration data target.
    '/api/v1/catalog': { target: LEGACY_PUBLIC_CATALOG_TARGET, changeOrigin: false },
  }
  return {
    base: environment.VITE_BASE_PATH || '/',
    // The selected proxy/build mode and the rendered app must be the same mode.
    // Leave mock and iframe/legacy linked builds under their existing environment setting.
    define: restoredLinked ? { 'import.meta.env.VITE_DATA_MODE': JSON.stringify(RESTORED_LINKED_MODE) } : {},
    plugins: [react(), ...(restoredLinked ? [restoredLinkedProxyGuardPlugin()] : [])],
    resolve: { dedupe: ['react', 'react-dom'] },
    server: {
      host: boundary.host,
      port: boundary.port,
      strictPort: true,
      proxy,
    },
    preview: {
      host: '0.0.0.0',
      port: 4174,
      strictPort: true,
    },
  }
}

export default defineConfig(({ mode }) => createFrontendViteConfig(mode))
