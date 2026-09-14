import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LinkedSearchProjection, LinkedState } from '../../../双端演示/src/contract'

const projection: LinkedSearchProjection = {
  mode: 'PARTIAL', gameCode: 'dwrg', gameId: 'game-dwrg', versionId: 'search-v1', versionNo: 1,
  baseConfigVersionId: 'base-v1', schemaHash: 'search-hash', evidenceHash: 'evidence-hash',
  coverage: { sourceActiveCount: 15, includedCount: 2, excludedCount: 13 }, excludedFields: [], issues: [],
  fields: [{ id: 'os', fieldKey: 'dwrg:platform', label: '操作系统', sourceId: 'attr-os', logicalKey: 'operating_system', valueType: 'ENUM', scene: 'SINGLE', operator: 'IN', isPrimary: true, sortOrder: 1, options: [{ id: 'ios', fullKey: 'ios', name: 'iOS', sortOrder: 1 }] }],
}

const linkedState = {
  sessionId: 'session-1', revision: 1, goods: [], media: {}, titleConfigs: [], publishConfigs: [], detailConfigs: [], searchConfigs: [], seller: { id: 'seller-1' },
  games: [
    { id: 'game-dwrg', code: 'dwrg', name: '第五人格', status: 'ACTIVE', rowVersion: 1, iconUrl: '', sortOrder: 1 },
    { id: 'game-wzry', code: 'wzry', name: '王者荣耀', status: 'ACTIVE', rowVersion: 1, iconUrl: '', sortOrder: 2 },
  ],
} as unknown as LinkedState

const linkedSearch = {
  state: linkedState, projection, currentProjection: projection, values: {}, request: null, issues: [], queryBlocked: false, conflict: '', chips: [],
  setValues: vi.fn(), removeValue: vi.fn(), applyLatest: vi.fn(),
}

vi.mock('../runtime/dataMode', () => ({
  isLinkedDataMode: true,
  getRuntimeStorage: () => ({ getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() }),
}))
vi.mock('../components/BottomNav', () => ({ BottomNav: () => <nav aria-label="底部导航" /> }))
vi.mock('./useLinkedSearch', () => ({ useLinkedSearch: () => linkedSearch }))
vi.mock('../repository/catalogRepository', () => ({
  catalogRepository: {
    getGame: (code: string) => ({ code, name: code === 'dwrg' ? '第五人格' : '王者荣耀', description: '', image: '', saleCount: 0 }),
    getGames: () => Promise.resolve([]), queryProducts: () => [], subscribe: () => () => undefined,
  },
}))

import { GameZonePage } from '../pages/GameZonePage'
import { LinkedSearchPage } from '../pages/SearchPage'

describe('linked search page branches', () => {
  beforeEach(() => vi.clearAllMocks())

  it('removes fixed 王者 recommendations and server filters from the linked game catalog', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/game?gameCode=dwrg']}><GameZonePage /></MemoryRouter>)
    expect(html).toContain('搜第五人格商品标题')
    expect(html).not.toContain('找皮肤')
    expect(html).not.toContain('荣耀王者')
    expect(html).not.toContain('QQ区')
    expect(html).not.toContain('>游戏区服<')
  })

  it('uses explicit linked games and omits fixed hot-search claims', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/search?gameCode=dwrg']}><LinkedSearchPage /></MemoryRouter>)
    expect(html).toContain('选择搜索游戏')
    expect(html).toContain('第五人格')
    expect(html).toContain('联动搜索')
    expect(html).not.toContain('大家在搜')
    expect(html).not.toContain('近 30 天成交均价')
    expect(html).not.toContain('王者 108英雄')
  })
})
