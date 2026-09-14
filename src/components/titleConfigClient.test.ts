import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TitleDefinition } from '@deepgamer/product-presentation'
import type { LinkedState } from '../../../双端演示/src/contract'
import { createLinkedTitleSeed } from '../../../双端演示/src/seed'
import { getLinkedTitleDefinitionSnapshot, loadTitleDefinition, parseTitleDefinitionPayload, refreshTitleDefinition, resetTitleDefinitionCacheForTests } from './titleConfigClient'

const definition: TitleDefinition = {
  gameCode: 'wzry',
  attributes: [],
  groups: [],
  template: { name: '标题配置', status: 'ACTIVE', definitionVersion: 'title-v2', sections: [] },
}

function response(payload: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => payload } as Response
}

function linkedState(): LinkedState {
  const titleConfigs = createLinkedTitleSeed()
  return {
    sessionId: 'linked-session-1', revision: 1, titleConfigs, publishConfigs: [], detailConfigs: [], searchConfigs: [], goods: [], media: {},
    games: titleConfigs.map((config, index) => ({
      id: config.gameId, code: config.gameCode, name: config.gameCode,
      status: 'ACTIVE', rowVersion: 1, iconUrl: null, sortOrder: index,
    })),
    seller: {
      id: 'linked_seller_001', displayName: '联动演示卖家', status: 'NONE', contractStatus: 'UNSIGNED',
      rowVersion: 1, application: null, applicationId: null, reviewReason: '', submittedAt: null, reviewedAt: null,
    },
  }
}

describe('title config client', () => {
  beforeEach(() => resetTitleDefinitionCacheForTests())
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

  it('does not request a backend when loading or refreshing the static Pages preview', async () => {
    vi.stubEnv('VITE_STATIC_PREVIEW', 'true')
    const fetcher = vi.fn(async () => response({ title: definition })) as unknown as typeof fetch
    await expect(loadTitleDefinition('wzry', fetcher)).resolves.toBeNull()
    await expect(refreshTitleDefinition('wzry', fetcher)).resolves.toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('only accepts the documented title envelopes', () => {
    expect(parseTitleDefinitionPayload({ title: definition })).toEqual(definition)
    expect(parseTitleDefinitionPayload({ data: { title: definition } })).toEqual(definition)
    expect(parseTitleDefinitionPayload({ data: definition })).toBeNull()
    expect(parseTitleDefinitionPayload({ title: { name: 'invalid' } })).toBeNull()
  })

  it('preserves outer published revision metadata and rejects malformed source trees', () => {
    expect(parseTitleDefinitionPayload({ data: { gameCode: 'dwrg', configVersionId: 'published-2', schemaHash: 'hash-2', title: definition } }))
      .toMatchObject({ gameCode: 'dwrg', configVersionId: 'published-2', schemaHash: 'hash-2' })
    expect(parseTitleDefinitionPayload({ title: { ...definition, template: { ...definition.template, sections: [null] } } })).toBeNull()
    expect(parseTitleDefinitionPayload({ title: { ...definition, attributes: [{ id: 'a', logicalKey: 'a', options: [null] }] } })).toBeNull()
  })

  it('rejects cross-game payloads before caching', async () => {
    const fetcher = vi.fn(async () => response({ data: { gameCode: 'dwrg', title: definition } })) as unknown as typeof fetch
    await expect(loadTitleDefinition('wzry', fetcher)).resolves.toBeNull()
  })

  it('refreshes an expired complete revision while keeping requests deduplicated', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-09T00:00:00Z'))
    const fetcher = vi.fn(async () => response({ data: { title: definition, schemaHash: 'one' } }))
    await loadTitleDefinition('wzry', fetcher as unknown as typeof fetch)
    await loadTitleDefinition('wzry', fetcher as unknown as typeof fetch)
    expect(fetcher).toHaveBeenCalledTimes(1)
    vi.setSystemTime(new Date('2026-09-09T00:01:01Z'))
    fetcher.mockImplementation(async () => response({ data: { title: definition, schemaHash: 'two' } }))
    const results = await Promise.all([loadTitleDefinition('wzry', fetcher as unknown as typeof fetch), loadTitleDefinition('wzry', fetcher as unknown as typeof fetch)])
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(results.every(result => result?.schemaHash === 'two')).toBe(true)
  })

  it('deduplicates a game request and uses the published endpoint', async () => {
    const fetcher = vi.fn(async () => response({ title: definition })) as unknown as typeof fetch
    const first = loadTitleDefinition('wzry', fetcher)
    const second = loadTitleDefinition('wzry', fetcher)
    await expect(first).resolves.toEqual(definition)
    await expect(second).resolves.toEqual(definition)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith('/api/v1/catalog/title-config/wzry', { headers: { accept: 'application/json' } })
  })

  it('keeps the last complete definition when refresh fails', async () => {
    const success = vi.fn(async () => response({ title: definition })) as unknown as typeof fetch
    const failure = vi.fn(async () => response({ error: 'down' }, false, 503)) as unknown as typeof fetch
    await expect(loadTitleDefinition('wzry', success)).resolves.toEqual(definition)
    await expect(refreshTitleDefinition('wzry', failure)).resolves.toEqual(definition)
  })

  it('returns null instead of unsafe content when the first request is invalid', async () => {
    const fetcher = vi.fn(async () => response({ title: { name: 'invalid' } })) as unknown as typeof fetch
    await expect(loadTitleDefinition('wzry', fetcher)).resolves.toBeNull()
  })

  it('keys linked TITLE only by session, game status and the published projection', () => {
    const state = linkedState()
    const published = getLinkedTitleDefinitionSnapshot(state, 'wzry')
    expect(published.definition).toMatchObject({ gameCode: 'wzry' })

    const draftSaved = structuredClone(state)
    const config = draftSaved.titleConfigs.find((item) => item.gameCode === 'wzry')!
    config.draftRevisionId = 'unpublished-draft'
    config.nextVersionNo += 1
    draftSaved.revision += 1
    expect(getLinkedTitleDefinitionSnapshot(draftSaved, 'wzry').key).toBe(published.key)

    const unpublished = structuredClone(state)
    unpublished.titleConfigs.find((item) => item.gameCode === 'wzry')!.publishedRevisionId = null
    expect(getLinkedTitleDefinitionSnapshot(unpublished, 'wzry')).toMatchObject({ definition: null })
    expect(getLinkedTitleDefinitionSnapshot(unpublished, 'wzry').key).not.toBe(published.key)

    const disabled = structuredClone(state)
    disabled.games.find((game) => game.code === 'wzry')!.status = 'DISABLED'
    const disabledSnapshot = getLinkedTitleDefinitionSnapshot(disabled, 'wzry')
    expect(disabledSnapshot.key).not.toBe(published.key)
    expect(disabledSnapshot.definition).toBeNull()

    expect(getLinkedTitleDefinitionSnapshot({ ...state, sessionId: 'linked-session-2' }, 'wzry').key).not.toBe(published.key)
    expect(getLinkedTitleDefinitionSnapshot(state, 'sjzxd').definition).toBeNull()
  })

  it('does not call the catalog HTTP endpoint in linked mode', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'linked')
    vi.resetModules()
    const linkedClient = await import('./titleConfigClient')
    const fetcher = vi.fn(async () => response({ title: definition })) as unknown as typeof fetch
    await expect(linkedClient.loadTitleDefinition('wzry', fetcher)).resolves.toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
})
