import { useEffect, useState } from 'react'
import type { TitleDefinition } from '@deepgamer/product-presentation'
import type { LinkedState } from '../../../双端演示/src/contract'
import { getLinkedState, subscribeLinkedState } from '../../../双端演示/src/client'
import { getPublishedTitleConfig } from '../../../双端演示/src/title-config'
import { isLinkedDataMode } from '../runtime/dataMode'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

type CacheEntry = {
  definition: TitleDefinition | null
  status: LoadStatus
  error: Error | null
  pending: Promise<TitleDefinition | null> | null
  listeners: Set<() => void>
  loadedAt: number
  linkedSnapshotKey: string | null
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000

function entryFor(gameCode: string): CacheEntry {
  const existing = cache.get(gameCode)
  if (existing) return existing
  const created: CacheEntry = { definition: null, status: 'idle', error: null, pending: null, listeners: new Set(), loadedAt: 0, linkedSnapshotKey: null }
  cache.set(gameCode, created)
  return created
}

function notify(entry: CacheEntry) {
  entry.listeners.forEach((listener) => listener())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTitleDefinition(value: unknown): value is TitleDefinition {
  if (!isRecord(value) || !isRecord(value.template)) return false
  return typeof value.template.name === 'string'
    && (value.template.status === 'ACTIVE' || value.template.status === 'DISABLED')
    && Array.isArray(value.template.sections)
    && value.template.sections.every(section => isRecord(section) && typeof section.sectionKey === 'string'
      && typeof section.displayType === 'string' && Array.isArray(section.fields)
      && section.fields.every(field => isRecord(field) && typeof field.fieldKey === 'string'
        && typeof field.label === 'string' && ['ATTRIBUTE', 'GROUP', 'STATIC'].includes(String(field.sourceType))
        && isRecord(field.display)))
    && Array.isArray(value.attributes)
    && value.attributes.every(attribute => isRecord(attribute) && typeof attribute.id === 'string'
      && typeof attribute.logicalKey === 'string' && Array.isArray(attribute.options) && validOptions(attribute.options))
    && Array.isArray(value.groups)
    && value.groups.every(group => isRecord(group) && typeof group.id === 'string'
      && Array.isArray(group.attributeIds) && Array.isArray(group.optionIds))
}

function validOptions(options: unknown[], depth = 0): boolean {
  return depth <= 8 && options.every(option => isRecord(option) && typeof option.id === 'string'
    && typeof option.fullKey === 'string' && typeof option.name === 'string'
    && (option.children === undefined || Array.isArray(option.children) && validOptions(option.children, depth + 1)))
}

/** Accepts only the documented endpoint envelopes, never arbitrary nested data. */
export function parseTitleDefinitionPayload(payload: unknown): TitleDefinition | null {
  if (!isRecord(payload)) return null
  const envelope = isRecord(payload.data) ? payload.data : payload
  if (!isTitleDefinition(envelope.title)) return null
  return {
    ...envelope.title,
    ...(typeof envelope.gameCode === 'string' ? { gameCode: envelope.gameCode } : {}),
    ...(typeof envelope.configVersionId === 'string' ? { configVersionId: envelope.configVersionId } : {}),
    ...(typeof envelope.schemaHash === 'string' ? { schemaHash: envelope.schemaHash } : {}),
  }
}

export type LinkedTitleDefinitionSnapshot = {
  key: string
  definition: TitleDefinition | null
  error: Error | null
}

/** Only state axes that can change the effective published TITLE participate in this key. */
export function getLinkedTitleDefinitionSnapshot(state: LinkedState | null, gameCode: string): LinkedTitleDefinitionSnapshot {
  if (!state) return { key: 'connecting', definition: null, error: null }
  const gameStatus = state.games.find((game) => game.code === gameCode)?.status ?? 'MISSING'
  const projection = getPublishedTitleConfig(state, gameCode)
  const key = JSON.stringify([state.sessionId, gameStatus, projection?.configVersionId ?? null, projection?.schemaHash ?? null])
  if (!projection) return { key, definition: null, error: null }
  const definition = parseTitleDefinitionPayload(projection)
  return definition
    ? { key, definition, error: null }
    : { key, definition: null, error: new Error('联动标题配置格式不正确') }
}

function syncLinkedDefinition(gameCode: string) {
  const entry = entryFor(gameCode)
  const snapshot = getLinkedTitleDefinitionSnapshot(getLinkedState(), gameCode)
  if (entry.linkedSnapshotKey === snapshot.key) return entry.definition
  entry.linkedSnapshotKey = snapshot.key
  entry.definition = snapshot.definition
  entry.status = snapshot.error ? 'error' : 'ready'
  entry.error = snapshot.error
  entry.pending = null
  entry.loadedAt = Date.now()
  notify(entry)
  return entry.definition
}

async function requestTitleDefinition(gameCode: string, fetcher: typeof fetch): Promise<TitleDefinition> {
  const response = await fetcher(`/api/v1/catalog/title-config/${encodeURIComponent(gameCode)}`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`标题配置加载失败（${response.status}）`)
  const definition = parseTitleDefinitionPayload(await response.json())
  if (!definition) throw new Error('标题配置响应格式不正确')
  if (definition.gameCode && definition.gameCode !== gameCode) throw new Error('标题配置不属于当前游戏')
  return definition
}

function startLoad(gameCode: string, fetcher: typeof fetch, force: boolean) {
  const entry = entryFor(gameCode)
  // GitHub Pages is a static prototype, not the local catalog API host.
  if (import.meta.env.VITE_STATIC_PREVIEW === 'true') {
    entry.status = 'ready'
    entry.error = null
    return Promise.resolve(entry.definition)
  }
  if (isLinkedDataMode) {
    return Promise.resolve(syncLinkedDefinition(gameCode))
  }
  if (entry.pending) return entry.pending
  if (!force && entry.status === 'ready' && Date.now() - entry.loadedAt < CACHE_TTL_MS) return Promise.resolve(entry.definition)
  entry.status = 'loading'
  entry.error = null
  notify(entry)
  entry.pending = requestTitleDefinition(gameCode, fetcher)
    .then((definition) => {
      entry.definition = definition
      entry.loadedAt = Date.now()
      entry.status = 'ready'
      return definition
    })
    .catch((error: unknown) => {
      entry.status = 'error'
      entry.error = error instanceof Error ? error : new Error('标题配置加载失败')
      return entry.definition
    })
    .finally(() => {
      entry.pending = null
      notify(entry)
    })
  return entry.pending
}

export function loadTitleDefinition(gameCode: string, fetcher: typeof fetch = fetch) {
  return startLoad(gameCode, fetcher, false)
}

/** Explicit refresh keeps the last complete definition if the new request fails. */
export function refreshTitleDefinition(gameCode: string, fetcher: typeof fetch = fetch) {
  return startLoad(gameCode, fetcher, true)
}

export function useTitleDefinition(gameCode: string) {
  const [snapshot, setSnapshot] = useState(() => {
    const entry = entryFor(gameCode)
    return { gameCode, definition: entry.definition, status: entry.status, error: entry.error }
  })

  useEffect(() => {
    const entry = entryFor(gameCode)
    const sync = () => setSnapshot({ gameCode, definition: entry.definition, status: entry.status, error: entry.error })
    if (isLinkedDataMode) {
      entry.listeners.add(sync)
      const unsubscribe = subscribeLinkedState(() => { syncLinkedDefinition(gameCode) })
      syncLinkedDefinition(gameCode)
      sync()
      return () => {
        entry.listeners.delete(sync)
        unsubscribe()
      }
    }
    const refreshIfStale = () => { if (document.visibilityState === 'visible') void loadTitleDefinition(gameCode) }
    entry.listeners.add(sync)
    window.addEventListener('focus', refreshIfStale)
    document.addEventListener('visibilitychange', refreshIfStale)
    const timer = window.setInterval(refreshIfStale, CACHE_TTL_MS)
    sync()
    void loadTitleDefinition(gameCode)
    return () => {
      entry.listeners.delete(sync)
      window.removeEventListener('focus', refreshIfStale)
      document.removeEventListener('visibilitychange', refreshIfStale)
      window.clearInterval(timer)
    }
  }, [gameCode])

  if (snapshot.gameCode === gameCode) return snapshot
  const current = entryFor(gameCode)
  return { gameCode, definition: current.definition, status: current.status, error: current.error }
}

export function resetTitleDefinitionCacheForTests() {
  cache.clear()
}
