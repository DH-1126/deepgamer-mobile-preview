import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAuthRepository } from '../repository/authRepository'
import { createFavoriteRepository } from '../repository/favoriteRepository'
import { createMessageRepository } from '../repository/messageRepository'

async function freshDocumentStorage() {
  vi.resetModules()
  return (await import('./dataMode')).getRuntimeStorage()
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('document-lifetime runtime storage', () => {
  it.each(['prototype', 'linked'])('%s 模式都不读取或清除浏览器已有数据', async (mode) => {
    vi.stubEnv('VITE_DATA_MODE', mode)
    const browserStorage = vi.fn(() => { throw new Error('Browser persistence must not be accessed') })
    vi.stubGlobal('window', Object.defineProperty({}, 'localStorage', { get: browserStorage }))

    const storage = await freshDocumentStorage()
    expect(storage.length).toBe(0)
    storage.setItem('demo', 'value')
    expect(storage.getItem('demo')).toBe('value')
    expect(browserStorage).not.toHaveBeenCalled()
  })

  it('同一文档共享存储，支持现有仓库使用的 Storage 接口', async () => {
    const storage = await freshDocumentStorage()
    storage.setItem('first', '1')
    storage.setItem('second', '2')
    const revisited = (await import('./dataMode')).getRuntimeStorage()
    expect(revisited).toBe(storage)
    expect(revisited.getItem('first')).toBe('1')
    expect(revisited.length).toBe(2)
    expect(revisited.key(0)).toBe('first')
    revisited.removeItem('first')
    expect(storage.getItem('first')).toBeNull()
    expect(storage.key(0)).toBe('second')
    expect(storage.key(1)).toBeNull()
    revisited.clear()
    expect(storage.length).toBe(0)
  })

  it('刷新后启动、隐私授权、登录与权限选择全部恢复初始状态', async () => {
    const storage = await freshDocumentStorage()
    const auth = createAuthRepository({ storage, persistSession: false })
    expect(auth.acceptInitialAgreement()).toBe(true)
    auth.completeLaunch()
    expect((await auth.loginOneTap(true)).ok).toBe(true)
    expect(auth.setPushPermission('denied')).toBe(true)
    expect(auth.hasCompletedLaunch()).toBe(true)
    expect(auth.isAuthenticated()).toBe(true)
    expect(createAuthRepository({ storage }).hasAcceptedInitialAgreement()).toBe(true)

    const refreshedStorage = await freshDocumentStorage()
    const refreshed = createAuthRepository({ storage: refreshedStorage, persistSession: false })
    expect(refreshedStorage).not.toBe(storage)
    expect(refreshed.hasCompletedLaunch()).toBe(false)
    expect(refreshed.hasAcceptedInitialAgreement()).toBe(false)
    expect(refreshed.isAuthenticated()).toBe(false)
    expect(refreshed.getPushPermission()).toBe('prompt')
  })

  it('跨页面保留收藏与消息操作，刷新恢复默认收藏和未读消息', async () => {
    const storage = await freshDocumentStorage()
    const now = () => 2_000_000_000_000
    const favorites = createFavoriteRepository({ storage, now })
    const messages = createMessageRepository({ storage, now })
    const initialFavorites = favorites.list()
    const initialSummary = await messages.summary()
    expect(initialFavorites.length).toBeGreaterThan(0)
    expect(initialSummary.unreadCount).toBeGreaterThan(0)
    expect(favorites.removeMany(initialFavorites.map(item => item.productId))).toBe(true)
    expect(await messages.markAllRead()).toBe(true)
    expect(createFavoriteRepository({ storage, now }).list()).toEqual([])
    expect((await createMessageRepository({ storage, now }).summary()).unreadCount).toBe(0)

    const refreshedStorage = await freshDocumentStorage()
    expect(createFavoriteRepository({ storage: refreshedStorage, now }).list()).toEqual(initialFavorites)
    expect((await createMessageRepository({ storage: refreshedStorage, now }).summary()).unreadCount).toBe(initialSummary.unreadCount)
  })
})
